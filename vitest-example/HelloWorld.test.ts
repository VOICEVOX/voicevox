import { expect, test } from 'vitest'
import { render } from 'vitest-browser-vue'
import HelloWorld from './HelloWorld.vue'

test('renders name', async () => {
  const { getByText } = render(HelloWorld, {
    props: { name: 'Vitest' },
  })
  await expect.element(getByText('Hello Vitest!')).toBeInTheDocument()
})
