import { newMockEvent } from "matchstick-as"
import { ethereum, Bytes, Address, BigInt } from "@graphprotocol/graph-ts"
import {
  AgentDeactivated,
  AgentReactivated,
  AgentRegistered,
  AgentUpdated,
  CapabilityRequested,
  OrchestratorAuthorized,
  OrchestratorRevoked,
  OwnershipTransferred,
  RatingSubmitted,
  TaskCompleted
} from "../generated/AgentRegistry/AgentRegistry"

export function createAgentDeactivatedEvent(
  agentId: Bytes,
  owner: Address,
  timestamp: BigInt
): AgentDeactivated {
  let agentDeactivatedEvent = changetype<AgentDeactivated>(newMockEvent())

  agentDeactivatedEvent.parameters = new Array()

  agentDeactivatedEvent.parameters.push(
    new ethereum.EventParam("agentId", ethereum.Value.fromFixedBytes(agentId))
  )
  agentDeactivatedEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  agentDeactivatedEvent.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  )

  return agentDeactivatedEvent
}

export function createAgentReactivatedEvent(
  agentId: Bytes,
  owner: Address,
  timestamp: BigInt
): AgentReactivated {
  let agentReactivatedEvent = changetype<AgentReactivated>(newMockEvent())

  agentReactivatedEvent.parameters = new Array()

  agentReactivatedEvent.parameters.push(
    new ethereum.EventParam("agentId", ethereum.Value.fromFixedBytes(agentId))
  )
  agentReactivatedEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  agentReactivatedEvent.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  )

  return agentReactivatedEvent
}

export function createAgentRegisteredEvent(
  agentId: Bytes,
  owner: Address,
  capabilities: Array<string>,
  pricePerTask: BigInt,
  ipfsCID: string,
  timestamp: BigInt
): AgentRegistered {
  let agentRegisteredEvent = changetype<AgentRegistered>(newMockEvent())

  agentRegisteredEvent.parameters = new Array()

  agentRegisteredEvent.parameters.push(
    new ethereum.EventParam("agentId", ethereum.Value.fromFixedBytes(agentId))
  )
  agentRegisteredEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  agentRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "capabilities",
      ethereum.Value.fromStringArray(capabilities)
    )
  )
  agentRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "pricePerTask",
      ethereum.Value.fromUnsignedBigInt(pricePerTask)
    )
  )
  agentRegisteredEvent.parameters.push(
    new ethereum.EventParam("ipfsCID", ethereum.Value.fromString(ipfsCID))
  )
  agentRegisteredEvent.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  )

  return agentRegisteredEvent
}

export function createAgentUpdatedEvent(
  agentId: Bytes,
  owner: Address,
  newIpfsCID: string,
  newPrice: BigInt,
  timestamp: BigInt
): AgentUpdated {
  let agentUpdatedEvent = changetype<AgentUpdated>(newMockEvent())

  agentUpdatedEvent.parameters = new Array()

  agentUpdatedEvent.parameters.push(
    new ethereum.EventParam("agentId", ethereum.Value.fromFixedBytes(agentId))
  )
  agentUpdatedEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  agentUpdatedEvent.parameters.push(
    new ethereum.EventParam("newIpfsCID", ethereum.Value.fromString(newIpfsCID))
  )
  agentUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "newPrice",
      ethereum.Value.fromUnsignedBigInt(newPrice)
    )
  )
  agentUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  )

  return agentUpdatedEvent
}

export function createCapabilityRequestedEvent(
  capability: string,
  totalDemand: BigInt,
  requester: Address,
  timestamp: BigInt
): CapabilityRequested {
  let capabilityRequestedEvent = changetype<CapabilityRequested>(newMockEvent())

  capabilityRequestedEvent.parameters = new Array()

  capabilityRequestedEvent.parameters.push(
    new ethereum.EventParam("capability", ethereum.Value.fromString(capability))
  )
  capabilityRequestedEvent.parameters.push(
    new ethereum.EventParam(
      "totalDemand",
      ethereum.Value.fromUnsignedBigInt(totalDemand)
    )
  )
  capabilityRequestedEvent.parameters.push(
    new ethereum.EventParam("requester", ethereum.Value.fromAddress(requester))
  )
  capabilityRequestedEvent.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  )

  return capabilityRequestedEvent
}

export function createOrchestratorAuthorizedEvent(
  orchestrator: Address,
  timestamp: BigInt
): OrchestratorAuthorized {
  let orchestratorAuthorizedEvent =
    changetype<OrchestratorAuthorized>(newMockEvent())

  orchestratorAuthorizedEvent.parameters = new Array()

  orchestratorAuthorizedEvent.parameters.push(
    new ethereum.EventParam(
      "orchestrator",
      ethereum.Value.fromAddress(orchestrator)
    )
  )
  orchestratorAuthorizedEvent.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  )

  return orchestratorAuthorizedEvent
}

export function createOrchestratorRevokedEvent(
  orchestrator: Address,
  timestamp: BigInt
): OrchestratorRevoked {
  let orchestratorRevokedEvent = changetype<OrchestratorRevoked>(newMockEvent())

  orchestratorRevokedEvent.parameters = new Array()

  orchestratorRevokedEvent.parameters.push(
    new ethereum.EventParam(
      "orchestrator",
      ethereum.Value.fromAddress(orchestrator)
    )
  )
  orchestratorRevokedEvent.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  )

  return orchestratorRevokedEvent
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent =
    changetype<OwnershipTransferred>(newMockEvent())

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createRatingSubmittedEvent(
  agentId: Bytes,
  rating: BigInt,
  newAverageX100: BigInt,
  timestamp: BigInt
): RatingSubmitted {
  let ratingSubmittedEvent = changetype<RatingSubmitted>(newMockEvent())

  ratingSubmittedEvent.parameters = new Array()

  ratingSubmittedEvent.parameters.push(
    new ethereum.EventParam("agentId", ethereum.Value.fromFixedBytes(agentId))
  )
  ratingSubmittedEvent.parameters.push(
    new ethereum.EventParam("rating", ethereum.Value.fromUnsignedBigInt(rating))
  )
  ratingSubmittedEvent.parameters.push(
    new ethereum.EventParam(
      "newAverageX100",
      ethereum.Value.fromUnsignedBigInt(newAverageX100)
    )
  )
  ratingSubmittedEvent.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  )

  return ratingSubmittedEvent
}

export function createTaskCompletedEvent(
  agentId: Bytes,
  owner: Address,
  orchestrator: Address,
  newTaskCount: BigInt,
  timestamp: BigInt
): TaskCompleted {
  let taskCompletedEvent = changetype<TaskCompleted>(newMockEvent())

  taskCompletedEvent.parameters = new Array()

  taskCompletedEvent.parameters.push(
    new ethereum.EventParam("agentId", ethereum.Value.fromFixedBytes(agentId))
  )
  taskCompletedEvent.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner))
  )
  taskCompletedEvent.parameters.push(
    new ethereum.EventParam(
      "orchestrator",
      ethereum.Value.fromAddress(orchestrator)
    )
  )
  taskCompletedEvent.parameters.push(
    new ethereum.EventParam(
      "newTaskCount",
      ethereum.Value.fromUnsignedBigInt(newTaskCount)
    )
  )
  taskCompletedEvent.parameters.push(
    new ethereum.EventParam(
      "timestamp",
      ethereum.Value.fromUnsignedBigInt(timestamp)
    )
  )

  return taskCompletedEvent
}
