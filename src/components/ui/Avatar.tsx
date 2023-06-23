import React from "react";

type Props = {
  children?: React.ReactNode;
};

const Avatar: React.FC<Props> = ({ children }) => {
  return (
    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center mr-4">
      {children}
    </div>
  );
};

export default Avatar;
