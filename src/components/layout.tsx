import { Inter } from "next/font/google";

interface LayoutProps {
  children?: React.ReactNode;
}

const inter = Inter({ subsets: ["latin"] });

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="mx-auto flex flex-col space-y-4">
      <main
        className={`flex min-h-screen flex-col items-center justify-between py-10 px-24 ${inter.className}`}
      >
        {children}
      </main>
    </div>
  );
}
