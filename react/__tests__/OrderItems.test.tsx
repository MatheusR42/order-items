import { adjust } from 'ramda'
import React, { FunctionComponent } from 'react'
import { MockedProvider } from '@apollo/react-testing'
import { act, render, fireEvent } from '@vtex/test-tools/react'
import { Item } from 'vtex.checkout-graphql'
import UpdateItem from 'vtex.checkout-resources/MutationUpdateItems'
import { OrderForm, OrderQueue } from 'vtex.order-manager'

import { mockOrderForm } from '../__fixtures__/mockOrderForm'
import { OrderItemsProvider, useOrderItems } from '../OrderItems'

const { OrderFormProvider, useOrderForm } = OrderForm
const { OrderQueueProvider } = OrderQueue

const mockUpdateItemMutation = (
  args: Array<Partial<Item>>,
  result: Array<Partial<Item>>
) => ({
  request: {
    query: UpdateItem,
    variables: {
      orderItems: args,
    },
  },
  result: {
    data: {
      updateItems: {
        ...mockOrderForm,
        items: result,
      },
    },
  },
})

describe('OrderItems', () => {
  it('should optimistically update itemList when updateQuantity is called', async () => {
    const Component: FunctionComponent = () => {
      const {
        orderForm: { items },
      } = useOrderForm()
      const { updateQuantity } = useOrderItems()
      return (
        <div>
          {items.map((item: Item) => (
            <div key={item.name!}>
              {item.name}: {item.quantity}
            </div>
          ))}
          <button onClick={() => updateQuantity({ index: 1, quantity: 123 })}>
            mutate
          </button>
        </div>
      )
    }

    const mockUpdateItem = mockUpdateItemMutation(
      [{ uniqueId: mockOrderForm.items[1].uniqueId, quantity: 123 }],
      adjust(
        1,
        (item: Item) => ({ ...item, quantity: 42 }),
        mockOrderForm.items
      )
    )

    const { getByText } = render(
      <MockedProvider mocks={[mockUpdateItem]} addTypename={false}>
        <OrderQueueProvider>
          <OrderFormProvider>
            <OrderItemsProvider>
              <Component />
            </OrderItemsProvider>
          </OrderFormProvider>
        </OrderQueueProvider>
      </MockedProvider>
    )

    const button = getByText('mutate')

    act(() => {
      fireEvent.click(button)
    })
    expect(getByText(`${mockOrderForm.items[1].name}: 123`)).toBeTruthy() // optimistic response

    await act(
      () =>
        new Promise<void>(resolve => {
          setTimeout(() => resolve())
        })
    ) // waits for actual mutation result
    expect(getByText(`${mockOrderForm.items[1].name}: 42`)).toBeTruthy()
  })

  it('should optimistically update itemList when removeItem is called', async () => {
    const Component: FunctionComponent = () => {
      const {
        orderForm: { items },
      } = useOrderForm()
      const { removeItem } = useOrderItems()
      return (
        <div>
          {items.map((item: Item) => (
            <div key={item.name!}>
              {item.name}: {item.quantity}
            </div>
          ))}
          <button
            onClick={() =>
              removeItem({ uniqueId: mockOrderForm.items[0].uniqueId })
            }
          >
            mutate
          </button>
        </div>
      )
    }

    const mockUpdateItem = mockUpdateItemMutation(
      [{ uniqueId: mockOrderForm.items[0].uniqueId, quantity: 0 }],
      adjust(0, (item: Item) => ({ ...item, quantity: 7 }), mockOrderForm.items)
    )

    const { getByText, queryByText } = render(
      <MockedProvider mocks={[mockUpdateItem]} addTypename={false}>
        <OrderQueueProvider>
          <OrderFormProvider>
            <OrderItemsProvider>
              <Component />
            </OrderItemsProvider>
          </OrderFormProvider>
        </OrderQueueProvider>
      </MockedProvider>
    )

    const button = getByText('mutate')

    act(() => {
      fireEvent.click(button)
    })
    expect(
      queryByText(
        (_, element) =>
          !!element.textContent &&
          element.textContent.includes(mockOrderForm.items[0].name)
      )
    ).toBeFalsy() // optimistic response

    await act(
      () => new Promise<void>(resolve => setTimeout(() => resolve()))
    ) // waits for actual mutation result
    expect(getByText(`${mockOrderForm.items[0].name}: 7`)).toBeTruthy()
  })
})
