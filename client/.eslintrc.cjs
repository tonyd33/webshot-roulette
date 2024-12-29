const eslintConfig = {
  extends: [
    "next/core-web-vitals",
    "next/typescript",
    "plugin:react-hooks/recommended",
    "plugin:storybook/recommended"
  ],
  rules: {
    "react-hooks/exhaustive-deps": [
      "warn",
      {
        additionalHooks: "(useStableCallback)",
      },
    ],
  },
};

module.exports = eslintConfig;
