import {
  PermissionRequest,
  EIP1193Error,
  EIP1193_ERROR_CODES,
  isEIP1193Error,
  EIP1193ErrorPayload,
} from "@tallyho/provider-bridge-shared"
import logger from "../../lib/logger"

export type PermissionMap = {
  evm: {
    [chainID: string]: {
      [address: string]: {
        [origin: string]: PermissionRequest
      }
    }
  }
}

export const keyPermissionsByChainIdAddressOrigin = (
  permissions: PermissionRequest[],
  permissionMap?: PermissionMap
): PermissionMap => {
  const map = permissionMap ?? { evm: {} }
  permissions.forEach((permission) => {
    map.evm[permission.chainID] ??= {}
    map.evm[permission.chainID][permission.accountAddress] ??= {}
    map.evm[permission.chainID][permission.accountAddress][permission.origin] =
      permission
  })
  return map
}

export function parsedRPCErrorResponse(error: { body: string }):
  | {
      code: number
      message: string
    }
  | undefined {
  try {
    const parsedError = JSON.parse(error.body).error
    return {
      /**
       * The code should be the same as for user rejected requests because otherwise it will not be displayed.
       */
      code: 4001,
      message:
        "message" in parsedError && parsedError.message
          ? parsedError.message[0].toUpperCase() + parsedError.message.slice(1)
          : EIP1193_ERROR_CODES.userRejectedRequest.message,
    }
  } catch (err) {
    return undefined
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function handleRPCErrorResponse(error: unknown) {
  let response
  logger.log("error processing request", error)
  if (typeof error === "object" && error !== null) {
    /**
     * Get error per the RPC method’s specification
     */
    if ("eip1193Error" in error) {
      const { eip1193Error } = error as {
        eip1193Error: EIP1193ErrorPayload
      }
      if (isEIP1193Error(eip1193Error)) {
        response = eip1193Error
      }
      /**
       * In the case of a non-matching error message, the error is returned without being nested in an object.
       * This is due to the error handling implementation.
       * Check the code for more details https://github.com/ethers-io/ethers.js/blob/master/packages/providers/src.ts/json-rpc-provider.ts#L96:L130
       */
    } else if ("body" in error) {
      response = parsedRPCErrorResponse(error as { body: string })
    } else if ("error" in error) {
      response = parsedRPCErrorResponse(
        (error as { error: { body: string } }).error
      )
    }
  }
  /**
   * If no specific error is obtained return a user rejected request error
   */
  return (
    response ??
    new EIP1193Error(EIP1193_ERROR_CODES.userRejectedRequest).toJSON()
  )
}
