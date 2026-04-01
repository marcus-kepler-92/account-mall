"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Eye, Pencil } from "lucide-react"

type Props = {
  id: string
  name: string
  status: "DRAFT" | "SENDING" | "SENT" | "FAILED"
}

export function CampaignRowActions({ id, status }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">操作菜单</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/admin/email-marketing/campaigns/${id}`}>
            <Eye className="size-4" />
            查看详情
          </Link>
        </DropdownMenuItem>
        {status === "DRAFT" && (
          <DropdownMenuItem asChild>
            <Link href={`/admin/email-marketing/campaigns/${id}`}>
              <Pencil className="size-4" />
              继续编辑
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
