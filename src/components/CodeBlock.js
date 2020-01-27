import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { coy } from "react-syntax-highlighter/dist/esm/styles/prism";

const CodeBlock = props => {
  const { language, value } = props;

  return (
      <SyntaxHighlighter language={language === 'daml' ? 'haskell' : language} style={coy}>
          {value || ''}
      </SyntaxHighlighter>
  );
};

export default CodeBlock;
