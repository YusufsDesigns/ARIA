import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import {
  AgentRegistered as AgentRegisteredEvent,
  AgentDeactivated as AgentDeactivatedEvent,
  AgentReactivated as AgentReactivatedEvent,
  TaskCompleted as TaskCompletedEvent,
  CapabilityRequested as CapabilityRequestedEvent,
} from '../generated/AgentRegistry/AgentRegistry'
import { Agent, CapabilityRequest, PaymentEvent } from '../generated/schema'

export function handleAgentRegistered(event: AgentRegisteredEvent): void {
  const agent = new Agent(event.params.agentId)
  agent.owner = event.params.owner
  // Name is derived from IPFS metadata; use empty string as placeholder
  agent.name = ''
  agent.capabilities = event.params.capabilities
  agent.pricePerTask = event.params.pricePerTask
  agent.ipfsCID = event.params.ipfsCID
  agent.isActive = true
  agent.tasksCompleted = BigInt.fromI32(0)
  agent.totalRating = BigInt.fromI32(0)
  agent.ratingCount = BigInt.fromI32(0)
  agent.registeredAt = event.params.timestamp
  agent.save()
}

export function handleAgentDeactivated(event: AgentDeactivatedEvent): void {
  const agent = Agent.load(event.params.agentId)
  if (agent) {
    agent.isActive = false
    agent.save()
  }
}

export function handleAgentReactivated(event: AgentReactivatedEvent): void {
  const agent = Agent.load(event.params.agentId)
  if (agent) {
    agent.isActive = true
    agent.save()
  }
}

export function handleTaskCompleted(event: TaskCompletedEvent): void {
  const agent = Agent.load(event.params.agentId)
  if (agent) {
    agent.tasksCompleted = event.params.newTaskCount
    agent.save()
  }

  const paymentId = event.transaction.hash.concatI32(event.logIndex.toI32())
  const payment = new PaymentEvent(paymentId)
  payment.agentId = event.params.agentId
  payment.agentOwner = event.params.owner
  payment.orchestrator = event.params.orchestrator
  payment.taskCount = event.params.newTaskCount
  payment.timestamp = event.block.timestamp
  payment.save()
}

export function handleCapabilityRequested(event: CapabilityRequestedEvent): void {
  let gap = CapabilityRequest.load(event.params.capability)
  if (!gap) {
    gap = new CapabilityRequest(event.params.capability)
    gap.capability = event.params.capability
    gap.demand = BigInt.fromI32(0)
  }
  gap.demand = event.params.totalDemand
  gap.lastRequestedAt = event.block.timestamp
  gap.save()
}
