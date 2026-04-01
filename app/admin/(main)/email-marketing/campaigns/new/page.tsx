"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, ArrowRight, Loader2, Send, Users, ShoppingCart, Eye } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/app/admin/components"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

type Template = {
  id: string
  title: string
  description: string | null
  defaultSubject: string
}

type RecipientType = "CUSTOMERS" | "DISTRIBUTORS"
type DistributorLevel = "all" | "level1" | "level2"

const STEPS = ["基本信息", "选择受众", "确认发送"]

function StepBasic({
  templates,
  templatesLoading,
  selectedTemplateId,
  onSelectTemplate,
  onPreviewTemplate,
  name,
  setName,
  subject,
  setSubject,
}: {
  templates: Template[]
  templatesLoading: boolean
  selectedTemplateId: string
  onSelectTemplate: (id: string) => void
  onPreviewTemplate: (id: string) => void
  name: string
  setName: (v: string) => void
  subject: string
  setSubject: (v: string) => void
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">活动名称</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：双十一促销活动"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">邮件主题</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="例：双十一大促，限时优惠！"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>选择模板（可选）</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelectTemplate("")}
            className={`rounded-lg border p-3 text-left text-sm transition-colors ${
              selectedTemplateId === ""
                ? "border-primary bg-primary/5"
                : "hover:border-muted-foreground/50"
            }`}
          >
            <p className="font-medium">不使用模板</p>
            <p className="text-xs text-muted-foreground mt-0.5">自定义 HTML 内容</p>
          </button>

          {templatesLoading
            ? Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-[58px] rounded-lg" />
              ))
            : templates.length === 0
            ? (
                <p className="col-span-2 text-xs text-muted-foreground py-1">
                  暂无自定义模板，可前往{" "}
                  <Link href="/admin/email-marketing/templates/new" className="underline underline-offset-2 hover:text-foreground" target="_blank">
                    邮件模板
                  </Link>{" "}
                  创建后回来选择。
                </p>
              )
            : templates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onSelectTemplate(t.id)}
                  className={`group relative rounded-lg border p-3 text-left text-sm transition-colors cursor-pointer ${
                    selectedTemplateId === t.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-muted-foreground/50"
                  }`}
                >
                  <div className="flex items-center gap-1.5 pr-7">
                    <p className="font-medium truncate">{t.title}</p>
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {t.description}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPreviewTemplate(t.id) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                    title="预览模板"
                  >
                    <Eye className="size-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
        </div>
      </div>
    </div>
  )
}

function StepRecipients({
  recipientType,
  setRecipientType,
  distributorLevel,
  setDistributorLevel,
  recipientCount,
  countLoading,
}: {
  recipientType: RecipientType
  setRecipientType: (v: RecipientType) => void
  distributorLevel: DistributorLevel
  setDistributorLevel: (v: DistributorLevel) => void
  recipientCount: number | null
  countLoading: boolean
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>受众类型</Label>
        <RadioGroup
          value={recipientType}
          onValueChange={(v) => setRecipientType(v as RecipientType)}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <label
            htmlFor="type-customers"
            className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
          >
            <RadioGroupItem value="CUSTOMERS" id="type-customers" />
            <div>
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-4 text-muted-foreground" />
                <span className="font-medium text-sm">下单客户</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">已完成订单的所有客户</p>
            </div>
          </label>
          <label
            htmlFor="type-distributors"
            className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
          >
            <RadioGroupItem value="DISTRIBUTORS" id="type-distributors" />
            <div>
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <span className="font-medium text-sm">分销员</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">平台注册分销员</p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {recipientType === "DISTRIBUTORS" && (
        <div className="space-y-3">
          <Label>分销员层级</Label>
          <RadioGroup
            value={distributorLevel}
            onValueChange={(v) => setDistributorLevel(v as DistributorLevel)}
            className="flex flex-wrap gap-4"
          >
            {(
              [
                { value: "all", label: "全部" },
                { value: "level1", label: "一级（无上级）" },
                { value: "level2", label: "二级（有上级）" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                htmlFor={`level-${opt.value}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                <RadioGroupItem value={opt.value} id={`level-${opt.value}`} />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      )}

      <div className="rounded-lg bg-muted/50 border px-4 py-3 flex items-center gap-3">
        {countLoading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Users className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm">
          {countLoading
            ? "正在计算收件人数量…"
            : recipientCount === null
            ? "尚未计算收件人"
            : `预计 ${recipientCount} 位收件人`}
        </span>
      </div>
    </div>
  )
}

function StepConfirm({
  name,
  subject,
  recipientType,
  distributorLevel,
  recipientCount,
  templateTitle,
}: {
  name: string
  subject: string
  recipientType: RecipientType
  distributorLevel: DistributorLevel
  recipientCount: number | null
  templateTitle: string
}) {
  const rows = [
    { label: "活动名称", value: name },
    { label: "邮件主题", value: subject },
    { label: "使用模板", value: templateTitle || "无" },
    { label: "受众类型", value: recipientType === "CUSTOMERS" ? "下单客户" : "分销员" },
    ...(recipientType === "DISTRIBUTORS"
      ? [
          {
            label: "分销员层级",
            value: ({ all: "全部", level1: "一级", level2: "二级" } as const)[distributorLevel],
          },
        ]
      : []),
    { label: "预计收件人", value: recipientCount !== null ? `${recipientCount} 人` : "—" },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        请确认以下发送信息无误，点击「确认发送」后将立即开始发送。
      </p>
      <div className="rounded-lg border divide-y">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium">{row.value}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        注意：Resend 免费版配额为 100 封/天，3000 封/月。发送后无法撤销。
      </p>
    </div>
  )
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)

  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState("")
  const [previewTitle, setPreviewTitle] = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")

  const [recipientType, setRecipientType] = useState<RecipientType>("CUSTOMERS")
  const [distributorLevel, setDistributorLevel] = useState<DistributorLevel>("all")
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [countLoading, setCountLoading] = useState(false)

  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [stepping, setStepping] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    fetch("/api/admin/email-marketing/templates")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setTemplates(data as Template[])
      })
      .catch(() => {})
      .finally(() => setTemplatesLoading(false))
  }, [])

  const handlePreviewTemplate = async (id: string) => {
    const t = templates.find((t) => t.id === id)
    setPreviewTitle(t?.title ?? "")
    setPreviewHtml("")
    setPreviewLoading(true)
    setPreviewOpen(true)
    try {
      const res = await fetch(`/api/admin/email-marketing/templates/${id}`)
      const data = await res.json()
      setPreviewHtml(data.html ?? "")
    } catch {
      // ignore
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id)
    if (id) {
      const t = templates.find((t) => t.id === id)
      if (t && !subject) setSubject(t.defaultSubject)
    }
  }

  const fetchCount = useCallback(async () => {
    if (!campaignId) return
    setCountLoading(true)
    try {
      const filter = recipientType === "DISTRIBUTORS" ? { level: distributorLevel } : {}
      const res = await fetch(
        `/api/admin/email-marketing/campaigns/${campaignId}/recipients`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientType, recipientFilter: filter }),
        }
      )
      if (res.ok) {
        const { count } = await res.json()
        setRecipientCount(count)
      }
    } catch {
      // ignore
    } finally {
      setCountLoading(false)
    }
  }, [campaignId, recipientType, distributorLevel])

  useEffect(() => {
    if (step !== 1) return
    const timer = setTimeout(fetchCount, 500)
    return () => clearTimeout(timer)
  }, [step, recipientType, distributorLevel, fetchCount])

  const buildRecipientFilter = () =>
    recipientType === "DISTRIBUTORS" ? { level: distributorLevel } : {}

  const resolveHtml = async () => {
    if (selectedTemplateId) {
      try {
        const res = await fetch(`/api/admin/email-marketing/templates/${selectedTemplateId}`)
        const t = await res.json()
        return t.html as string
      } catch {
        // ignore
      }
    }
    return "<p>请在模板编辑器中填写邮件内容</p>"
  }

  const handleNext = async () => {
    setStepping(true)
    try {
    if (step === 0) {
      if (!name.trim()) { toast.error("请填写活动名称"); return }
      if (!subject.trim()) { toast.error("请填写邮件主题"); return }

      const html = await resolveHtml()

      if (!campaignId) {
        const res = await fetch("/api/admin/email-marketing/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            subject: subject.trim(),
            html,
            templateId: selectedTemplateId || null,
            recipientType,
            recipientFilter: buildRecipientFilter(),
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          toast.error(data?.error ?? "创建失败")
          return
        }
        const campaign = await res.json()
        setCampaignId(campaign.id)
      } else {
        // Sync changes made after going back to step 0
        const syncRes = await fetch(`/api/admin/email-marketing/campaigns/${campaignId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            subject: subject.trim(),
            html,
            templateId: selectedTemplateId || null,
          }),
        })
        if (!syncRes.ok) {
          const data = await syncRes.json().catch(() => ({}))
          toast.error(data?.error ?? "同步失败，请重试")
          return
        }
      }
    }

    if (step === 1 && campaignId) {
      await fetch(`/api/admin/email-marketing/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientType,
          recipientFilter: buildRecipientFilter(),
        }),
      })
    }

    setStep((s) => s + 1)
    } finally {
      setStepping(false)
    }
  }

  const handleSend = async () => {
    if (!campaignId) return
    setSending(true)
    try {
      const res = await fetch(
        `/api/admin/email-marketing/campaigns/${campaignId}/send`,
        { method: "POST" }
      )
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`发送完成，成功 ${data.successCount} / 失败 ${data.failCount}`)
        router.push(`/admin/email-marketing/campaigns/${campaignId}`)
      } else {
        toast.error(data?.error ?? "发送失败")
      }
    } catch {
      toast.error("发送失败")
    } finally {
      setSending(false)
      setConfirmOpen(false)
    }
  }

  const templateTitle = selectedTemplateId
    ? (templates.find((t) => t.id === selectedTemplateId)?.title ?? "")
    : ""

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/email-marketing">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <PageHeader title="新建群发活动" description="三步完成邮件群发配置" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center">
        {STEPS.map((label, i) => (
          <Fragment key={label}>
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={`flex size-7 items-center justify-center rounded-full text-xs font-medium ${
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                    ? "border-2 border-primary text-primary"
                    : "border-2 border-muted-foreground/30 text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-sm hidden sm:block ${
                  i === step ? "font-medium" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-px bg-border mx-3 min-w-6" />
            )}
          </Fragment>
        ))}
      </div>

      {/* Step content */}
      <Card>
        <CardContent className="pt-6">
          {step === 0 && (
            <StepBasic
              templates={templates}
              templatesLoading={templatesLoading}
              selectedTemplateId={selectedTemplateId}
              onSelectTemplate={handleSelectTemplate}
              onPreviewTemplate={handlePreviewTemplate}
              name={name}
              setName={setName}
              subject={subject}
              setSubject={setSubject}
            />
          )}
          {step === 1 && (
            <StepRecipients
              recipientType={recipientType}
              setRecipientType={setRecipientType}
              distributorLevel={distributorLevel}
              setDistributorLevel={setDistributorLevel}
              recipientCount={recipientCount}
              countLoading={countLoading}
            />
          )}
          {step === 2 && (
            <StepConfirm
              name={name}
              subject={subject}
              recipientType={recipientType}
              distributorLevel={distributorLevel}
              recipientCount={recipientCount}
              templateTitle={templateTitle}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" />
          上一步
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={stepping}>
            {stepping && <Loader2 className="size-4 animate-spin" />}
            下一步
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={sending || recipientCount === 0}
          >
            <Send className="size-4" />
            确认发送给 {recipientCount ?? "—"} 位收件人
          </Button>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="truncate">{previewTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <iframe
                srcDoc={previewHtml ?? ""}
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
                title="邮件预览"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认发送</AlertDialogTitle>
            <AlertDialogDescription>
              即将向 <strong>{recipientCount ?? "—"} 位</strong>收件人发送邮件。
              发送后无法撤销，请确认无误。
              <br />
              <span className="text-xs mt-2 block text-muted-foreground">
                注意：Resend 免费版配额 100 封/天、3000 封/月
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleSend() }}
              disabled={sending}
            >
              {sending && <Loader2 className="size-4 animate-spin" />}
              确认发送
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
