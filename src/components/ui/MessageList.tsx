import React, { Fragment } from "react";
import type { Message } from "@/types/chat";
import styles from "@/styles/Message.module.css";
import Avatar from "./Avatar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@radix-ui/react-accordion";

type Props = {
  loading?: boolean;
  messages: Array<Message>;
};

type Ref = HTMLDivElement;

// eslint-disable-next-line react/display-name
const MessageList = React.forwardRef<Ref, Props>(
  ({ loading = false, messages }, ref) => {
    return (
      <div ref={ref} className={styles.messagelist}>
        {messages.map((message, index) => {
          let icon;
          let className;
          if (message.type === "apiMessage") {
            icon = <Avatar>🤖</Avatar>;
            className = styles.apimessage;
          } else {
            icon = <Avatar>👨‍💻</Avatar>;
            // The latest message sent by the user will be animated while waiting for a response
            className =
              loading && index === messages.length - 1
                ? styles.usermessagewaiting
                : styles.usermessage;
          }
          return (
            <Fragment key={index}>
              <div key={`chatMessage-${index}`} className={className}>
                <div className="flex">
                  <div className="flex-none">{icon}</div>
                  <div className="grow">
                    <div className={styles.markdownanswer}>
                      <p>{message.message}</p>
                    </div>
                  </div>
                </div>
              </div>
              {message.sourceDocs && (
                <div
                  className="p-5 text-slate-600"
                  key={`sourceDocsAccordion-${index}`}
                >
                  <p className="my-2 flex items-center text-sm  text-black">
                    <svg
                      stroke="currentColor"
                      fill="currentColor"
                      strokeWidth="0"
                      viewBox="0 0 24 24"
                      className="mr-1 text-green-500"
                      height="1em"
                      width="1em"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path fill="none" d="M0 0h24v24H0z"></path>
                      <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path>
                    </svg>
                    Verified Sources:
                  </p>
                  <Accordion
                    type="single"
                    collapsible
                    className="flex-col space-y-2"
                  >
                    {message.sourceDocs.map((doc, index) => (
                      <div
                        key={`messageSourceDocs-${index}`}
                        className="p-1 border rounded"
                      >
                        <AccordionItem value={`item-${index}`}>
                          <AccordionTrigger>
                            <h3>Source {index + 1}</h3>
                          </AccordionTrigger>
                          <AccordionContent>
                            <>
                              <p>{doc.pageContent}</p>
                              <p className="mt-2">
                                <b>Source:</b> {doc.metadata.source}
                              </p>
                            </>
                          </AccordionContent>
                        </AccordionItem>
                      </div>
                    ))}
                  </Accordion>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    );
  }
);

export default MessageList;
