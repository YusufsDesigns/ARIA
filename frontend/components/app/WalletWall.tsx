'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import { SmokeBackground } from '@/components/ui/smoke-background'
import { useWallet } from '@/components/app/WalletContext'

const PRESETS = [5, 10, 15]

// Shown when the wallet is not connected. The budget selector lives HERE so the
// ERC-7715 grant is created with the right USDC cap (preserving the delegation /
// payment flow). Per-task budgets are later clamped to this granted cap.
export function WalletWall() {
  const { onConnected } = useWallet()
  const [budget, setBudget] = useState(15)

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div className="absolute inset-0 z-0">
        <SmokeBackground smokeColor="#FF6B35" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-6 px-6">
        <Image src="/Logo.png" alt="ARIA" width={120} height={46} priority className="object-contain [filter:brightness(0)_invert(1)]" />

        <h1 className="font-display text-white uppercase tracking-tight text-3xl md:text-5xl text-center leading-tight">
          Connect your wallet
          <br />
          to continue
        </h1>

        <p className="text-white/40 font-body text-center max-w-xs">
          Your wallet address is your account. No signup required.
        </p>

        {/* Spending cap — sets the ERC-7715 grant amount */}
        <div className="text-center">
          <p className="font-display text-[11px] uppercase tracking-[0.1em] text-white/35 mb-3">Set spending cap</p>
          <div className="flex gap-2 justify-center">
            {PRESETS.map((b) => (
              <button
                key={b}
                onClick={() => setBudget(b)}
                className={`font-display text-sm font-semibold px-5 py-2 border transition-all ${
                  budget === b
                    ? 'border-[#FF6B35] bg-[#FF6B35]/[0.12] text-[#FF6B35]'
                    : 'border-white/12 text-white/30 hover:border-white/30'
                }`}
              >
                {b} USDC
              </button>
            ))}
          </div>
          <p className="font-body text-[11px] text-white/20 mt-2">Agents charge 0.20–0.60 USDC per task · Unused budget is never spent</p>
        </div>

        <ConnectButton onConnected={onConnected} budgetUsdc={budget} />
        <p className="font-body text-xs text-white/20 text-center tracking-wide">
          Zero data retention · ERC-7710 micropayments
        </p>
      </div>
    </div>
  )
}
