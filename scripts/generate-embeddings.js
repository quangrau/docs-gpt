import dotenv from "dotenv";
import { u } from "unist-builder";
import { filter } from "unist-util-filter";
import { createHash } from "crypto";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";
import { toString } from "mdast-util-to-string";
import { mdxFromMarkdown } from "mdast-util-mdx";
import { readFile } from "fs/promises";
import { mdxjs } from "micromark-extension-mdxjs";
import GithubSlugger from "github-slugger";
import { createClient } from "@supabase/supabase-js";
import "openai";
import { Configuration, OpenAIApi } from "openai";

dotenv.config();

/**
 * Extracts ES literals from an `estree` `ObjectExpression`
 * into a plain JavaScript object.
 */
function getObjectFromExpression(node) {
  return node.properties.reduce((object, property) => {
    if (property.type !== "Property") {
      return object;
    }

    const key =
      (property.key.type === "Identifier" && property.key.name) || undefined;
    const value =
      (property.value.type === "Literal" && property.value.value) || undefined;

    if (!key) {
      return object;
    }

    return {
      ...object,
      [key]: value,
    };
  }, {});
}

/**
 * Extracts the `meta` ESM export from the MDX file.
 *
 * This info is akin to frontmatter.
 */
function extractMetaExport(mdxTree) {
  const metaExportNode = mdxTree.children.find((node) => {
    return (
      node.type === "mdxjsEsm" &&
      node.data?.estree?.body[0]?.type === "ExportNamedDeclaration" &&
      node.data.estree.body[0].declaration?.type === "VariableDeclaration" &&
      node.data.estree.body[0].declaration.declarations[0]?.id.type ===
        "Identifier" &&
      node.data.estree.body[0].declaration.declarations[0].id.name === "meta"
    );
  });

  if (!metaExportNode) {
    return undefined;
  }

  const objectExpression =
    (metaExportNode.data?.estree?.body[0]?.type === "ExportNamedDeclaration" &&
      metaExportNode.data.estree.body[0].declaration?.type ===
        "VariableDeclaration" &&
      metaExportNode.data.estree.body[0].declaration.declarations[0]?.id
        .type === "Identifier" &&
      metaExportNode.data.estree.body[0].declaration.declarations[0].id.name ===
        "meta" &&
      metaExportNode.data.estree.body[0].declaration.declarations[0].init
        ?.type === "ObjectExpression" &&
      metaExportNode.data.estree.body[0].declaration.declarations[0].init) ||
    undefined;

  if (!objectExpression) {
    return undefined;
  }

  return getObjectFromExpression(objectExpression);
}

/**
 * Splits a `mdast` tree into multiple trees based on
 * a predicate function. Will include the splitting node
 * at the beginning of each tree.
 *
 * Useful to split a markdown file into smaller sections.
 */
function splitTreeBy(tree, predicate) {
  return tree.children.reduce((trees, node) => {
    const [lastTree] = trees.slice(-1);

    if (!lastTree || predicate(node)) {
      const tree = u("root", [node]);
      return trees.concat(tree);
    }

    lastTree.children.push(node);
    return trees;
  }, []);
}

async function getDocuments() {
  return [
    "docs/guides/basic-features/api-keys.mdx",
    "docs/guides/basic-features/css.mdx",
    "docs/guides/basic-features/mock.mdx",
  ];
}

/**
 * Processes MDX content for search indexing.
 * It extracts metadata, strips it of all JSX,
 * and splits it into sub-sections based on criteria.
 */
function processMdxForSearch(content) {
  const checksum = createHash("sha256").update(content).digest("base64");

  const mdxTree = fromMarkdown(content, {
    extensions: [mdxjs()],
    mdastExtensions: [mdxFromMarkdown()],
  });

  const meta = extractMetaExport(mdxTree);

  // Remove all MDX elements from markdown
  const mdTree = filter(
    mdxTree,
    (node) =>
      ![
        "mdxjsEsm",
        "mdxJsxFlowElement",
        "mdxJsxTextElement",
        "mdxFlowExpression",
        "mdxTextExpression",
      ].includes(node.type)
  );

  if (!mdTree) {
    return {
      checksum,
      meta,
      sections: [],
    };
  }

  const sectionTrees = splitTreeBy(mdTree, (node) => node.type === "heading");

  const slugger = new GithubSlugger();

  const sections = sectionTrees.map((tree) => {
    const [firstNode] = tree.children;
    const heading =
      firstNode.type === "heading" ? toString(firstNode) : undefined;
    const slug = heading ? slugger.slug(heading) : undefined;

    return {
      content: toMarkdown(tree),
      heading,
      slug,
    };
  });

  return {
    checksum,
    meta,
    sections,
  };
}

async function generateEmbeddings() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.OPENAI_KEY
  ) {
    return console.log(
      "Environment variables NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_KEY are required: skipping embeddings generation"
    );
  }

  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  /**
   * Assuming document is a path to mdx file
   */
  const documents = await getDocuments();
  for (const path of documents) {
    const parentPath = "";
    const contents = await readFile(path, "utf8");
    const { checksum, meta, sections } = processMdxForSearch(contents);

    // console.log(document, checksum, meta, sections);

    // Check for existing page in DB and compare checksums
    const { error: fetchPageError, data: existingPage } = await supabaseClient
      .from("page")
      .select("id, path, checksum, parentPage:parent_page_id(id, path)")
      .filter("path", "eq", path)
      .limit(1)
      .maybeSingle();

    if (fetchPageError) {
      throw fetchPageError;
    }

    // We use checksum to determine if this page & its sections need to be regenerated
    if (existingPage?.checksum === checksum) {
      const existingParentPage = existingPage?.parentPage;

      // If parent page changed, update it
      if (existingParentPage?.path !== parentPath) {
        console.log(
          `[${path}] Parent page has changed. Updating to '${parentPath}'...`
        );
      }
    }

    const { error: fetchParentPageError, data: parentPage } =
      await supabaseClient
        .from("page")
        .select()
        .filter("path", "eq", parentPath)
        .limit(1)
        .maybeSingle();

    if (fetchParentPageError) {
      throw fetchParentPageError;
    }

    // Create/update page record. Intentionally clear checksum until we
    // have successfully generated all page sections.
    const { error: upsertPageError, data: page } = await supabaseClient
      .from("page")
      .upsert(
        {
          checksum: null,
          path,
          type: "guides",
          source: "",
          meta,
          parent_page_id: parentPage?.id,
        },
        { onConflict: "path" }
      )
      .select()
      .limit(1)
      .single();

    if (upsertPageError) {
      throw upsertPageError;
    }

    console.log(
      `[${path}] Adding ${sections.length} page sections (with embeddings)`
    );

    for (const { slug, heading, content } of sections) {
      // OpenAI recommends replacing newlines with spaces for best results (specific to embeddings)
      const input = content.replace(/\n/g, " ");

      try {
        const configuration = new Configuration({
          apiKey: process.env.OPENAI_KEY,
        });
        const openai = new OpenAIApi(configuration);

        const embeddingResponse = await openai.createEmbedding({
          model: "text-embedding-ada-002",
          input,
        });

        if (embeddingResponse.status !== 200) {
          throw new Error(inspect(embeddingResponse.data, false, 2));
        }

        const [responseData] = embeddingResponse.data.data;
        const { error: insertPageSectionError, data: pageSection } =
          await supabaseClient
            .from("page_section")
            .insert({
              page_id: page.id,
              slug,
              heading,
              content,
              token_count: embeddingResponse.data.usage.total_tokens,
              embedding: responseData.embedding,
            })
            .select()
            .limit(1)
            .single();

        if (insertPageSectionError) {
          throw insertPageSectionError;
        }
      } catch (err) {
        // TODO: decide how to better handle failed embeddings
        console.error(
          `Failed to generate embeddings for '${path}' page section starting with '${input.slice(
            0,
            40
          )}...'`
        );

        throw err;
      }
    }
  }
}

async function main() {
  await generateEmbeddings();
}

main().catch((err) => console.error(err));
