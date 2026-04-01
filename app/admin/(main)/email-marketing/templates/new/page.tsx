import { config } from "@/lib/config"
import { makeDefaultEmailDesign } from "@/lib/email-marketing-default-design"
import { NewTemplateForm } from "./new-template-form"

export default function NewTemplatePage() {
  const initialDesign = makeDefaultEmailDesign(config.siteName)
  return <NewTemplateForm initialDesign={initialDesign} />
}
