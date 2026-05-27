import { cn } from "@/lib/utils"

type BrandMarkProps = {
    className?: string
    title?: string
}

export function BrandMark({ className, title }: BrandMarkProps) {
    return (
        <span
            className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden", className)}
            aria-hidden={title ? undefined : true}
            role={title ? "img" : undefined}
            aria-label={title}
        >
            <svg
                viewBox="0 0 256 256"
                xmlns="http://www.w3.org/2000/svg"
                className="h-full w-full"
            >
                <rect width="256" height="256" rx="40" fill="#0E1729" />
                <path d="M56 64L96 64L128 168L160 64L200 64L128 216Z" fill="#F2EBDD" />
                <circle cx="128" cy="168" r="9" fill="#0E1729" />
                <circle cx="128" cy="168" r="5" fill="#C8A06A" />
            </svg>
        </span>
    )
}
