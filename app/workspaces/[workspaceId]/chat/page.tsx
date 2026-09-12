'use client'

import { use } from 'react'
import { ChatView } from '@/components/querypilot'

export default function WorkspaceNewChatPage({
  params,
}: {
  params: Promise<{
    workspaceId: string
  }>
}) {
  const { workspaceId } = use(params)

  const id = Number(workspaceId)

  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="p-8 text-sm text-red-300">
        Invalid workspace.
      </div>
    )
  }

  return (
    <ChatView
      key={`new-${id}`}
      workspaceId={id}
    />
  )
}