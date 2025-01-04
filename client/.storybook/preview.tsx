import React from "react";
import type { Preview } from "@storybook/react";
import { comic_neue, geistMono, geistSans } from "../app/layout";
import { Toaster } from "../components/ui/toaster";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => (
      <div
        className={`${geistSans.variable} ${geistMono.variable} ${comic_neue.variable} antialiased`}
      >
        <Story />
        <Toaster />
      </div>
    ),
  ],
};

export default preview;
