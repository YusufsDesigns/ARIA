import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Bytes, Address, BigInt } from "@graphprotocol/graph-ts"
import { AgentDeactivated } from "../generated/schema"
import { AgentDeactivated as AgentDeactivatedEvent } from "../generated/AgentRegistry/AgentRegistry"
import { handleAgentDeactivated } from "../src/agent-registry"
import { createAgentDeactivatedEvent } from "./agent-registry-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let agentId = Bytes.fromI32(1234567890)
    let owner = Address.fromString("0x0000000000000000000000000000000000000001")
    let timestamp = BigInt.fromI32(234)
    let newAgentDeactivatedEvent = createAgentDeactivatedEvent(
      agentId,
      owner,
      timestamp
    )
    handleAgentDeactivated(newAgentDeactivatedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test("AgentDeactivated created and stored", () => {
    assert.entityCount("AgentDeactivated", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "AgentDeactivated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "agentId",
      "1234567890"
    )
    assert.fieldEquals(
      "AgentDeactivated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "owner",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "AgentDeactivated",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "timestamp",
      "234"
    )

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  })
})
