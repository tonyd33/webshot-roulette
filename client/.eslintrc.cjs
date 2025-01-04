const eslintConfig = {
  extends: [
    "next/core-web-vitals",
    "next/typescript",
    "plugin:react-hooks/recommended",
    "plugin:storybook/recommended",
  ],
  rules: {
    "react-hooks/exhaustive-deps": [
      "warn",
      {
        additionalHooks: "(useStableCallback)",
      },
    ],
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      },
    ],
  },
};

module.exports = eslintConfig;
