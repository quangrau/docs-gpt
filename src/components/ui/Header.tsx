import React from "react";
import Image from "next/image";

type Props = {};

const Header = (props: Props) => {
  return (
    <div className="mx-auto flex flex-col gap-4 justify-center items-center">
      <Image
        src="/logo.svg"
        alt="Slardar Logo"
        width={64}
        height={24}
        priority
      />
      <h1 className="text-4xl font-bold leading-[1.1] tracking-tighter text-center text-blue-600">
        AI-powered Assistant for Slardar
      </h1>
    </div>
  );
};

export default Header;
