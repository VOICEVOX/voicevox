import type { Meta, StoryObj } from "@storybook/vue3";

import BaseDocumentView from "./BaseDocumentView.vue";

const meta: Meta<typeof BaseDocumentView> = {
  component: BaseDocumentView,
};

export default meta;
type Story = StoryObj<typeof BaseDocumentView>;

export const Default: Story = {
  render: (args) => ({
    components: { BaseDocumentView },

    setup() {
      return { args };
    },

    template: `
      <BaseDocumentView>
        <h1>Heading 1</h1>
        <h2>Heading 2</h2>
        <h3>Heading 3</h3>
        <h4>Heading 4</h4>
        <h5>Heading 5</h5>
        <h6>Heading 6</h6>
        <p>ParagraphParagraph<a href="#">Link</a>ParagraphParagraph<code>code</code>ParagraphParagraph</p>
        <ul>
          <li>List</li>
          <li>List</li>
          <li>List</li>
        </ul>
        <ol>
          <li>List</li>
          <li>List</li>
          <li>List</li>
        </ol>
        <pre>pre</pre>
        <details>
        <summary>summary</summary>
        <p>Details</p>
        </details>
        <table>
          <thead>
            <tr>
              <th>Table Header</th>
              <th>Table Header</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Table</td>
              <td>Table</td>
            </tr>
            <tr>
              <td>Table</td>
              <td>Table</td>
            </tr>
            <tr>
              <td>Table</td>
              <td>Table</td>
            </tr>
            <tr>
              <td>Table</td>
              <td>Table</td>
            </tr>
            <tr>
              <td>Table</td>
              <td>Table</td>
            </tr>
          </tbody>
        </table>
      </BaseDocumentView>`,
  }),
};
