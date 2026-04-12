import { PageHeader } from "@/app/admin/components"
import { MediaLibrary } from "@/app/admin/components/media-library"

export default function AdminFilesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="文件管理"
        description="按目录查看、上传与删除已上传的图片与凭证，可复制链接用于内容中引用"
      />
      <MediaLibrary mode="manage" />
    </div>
  )
}
