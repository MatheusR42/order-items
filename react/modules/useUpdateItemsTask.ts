import React, { useCallback } from 'react'
import { useMutation } from 'react-apollo'
import UpdateItems from 'vtex.checkout-resources/MutationUpdateItems'
import { OrderForm } from 'vtex.order-manager'
import { Item } from 'vtex.checkout-graphql'

import { UpdateQuantityInput } from './localOrderQueue'
import { filterUndefined } from '../utils'

const { useOrderForm } = OrderForm

export const useUpdateItemsTask = (
  fakeUniqueIdMapRef: React.MutableRefObject<FakeUniqueIdMap>
) => {
  const [mutateUpdateQuantity] = useMutation<UpdateItemsMutation>(UpdateItems)
  const { setOrderForm } = useOrderForm()

  const updateItemTask = useCallback(
    ({
      items,
      orderFormItems,
    }: {
      items: UpdateQuantityInput[]
      orderFormItems: Item[]
    }) => {
      return {
        execute: async () => {
          const mutationVariables = {
            orderItems: items.map((input) => {
              if ('uniqueId' in input) {
                // here we need to update the uniqueId again in the mutation
                // because it may have been a "fake" `uniqueId` that were generated
                // locally so we could manage the items when offline.
                //
                // so, we will read the value using the `fakeUniqueIdMapRef` because
                // it maps a fake `uniqueId` to a real `uniqueId` that was generated by
                // the API. if it doesn't contain the value, we will assume that this uniqueId
                // is a real one.
                const uniqueId =
                  fakeUniqueIdMapRef.current[input.uniqueId] || input.uniqueId

                return { uniqueId, quantity: input.quantity }
              }

              return input
            }),
          }

          const { data } = await mutateUpdateQuantity({
            variables: mutationVariables,
          })

          return data!.updateItems
        },
        rollback: () => {
          const deletedItemsInput = items.filter(
            ({ quantity }) => quantity === 0
          )

          const updatedItemsInput = items.filter(
            ({ quantity }) => quantity !== 0
          )

          const deletedItems = deletedItemsInput
            .map((input) => {
              return orderFormItems.find((orderFormItem, itemIndex) =>
                'uniqueId' in input
                  ? orderFormItem.uniqueId === input.uniqueId
                  : input.index === itemIndex
              )
            })
            .filter(filterUndefined)

          setOrderForm((prevOrderForm) => {
            return {
              ...prevOrderForm,
              items: prevOrderForm.items
                .map((orderFormItem) => {
                  const updatedIndex = updatedItemsInput.findIndex(
                    (item, itemIndex) =>
                      'uniqueId' in item
                        ? orderFormItem.uniqueId === item.uniqueId
                        : itemIndex === item.index
                  )

                  if (updatedIndex !== -1) {
                    const updatedItemInput = updatedItemsInput[updatedIndex]

                    const previousItem = orderFormItems.find(
                      (prevOrderFormItem, prevOrderFormItemIndex) =>
                        'uniqueId' in updatedItemInput
                          ? prevOrderFormItem.uniqueId ===
                            updatedItemInput.uniqueId
                          : prevOrderFormItemIndex === updatedItemInput.index
                    )

                    return {
                      ...orderFormItem,
                      quantity: previousItem!.quantity,
                    }
                  }

                  return orderFormItem
                })
                .concat(deletedItems),
            }
          })
        },
      }
    },
    [fakeUniqueIdMapRef, mutateUpdateQuantity, setOrderForm]
  )

  return updateItemTask
}