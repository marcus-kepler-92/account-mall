/**
 * Default Unlayer design for new email templates.
 * Mirrors the BaseNotification layout: gray outer background, white card,
 * brand header → heading → body → divider → footer.
 * Colors and font family match app/emails/theme.ts.
 */
export function makeDefaultEmailDesign(siteName: string): Record<string, unknown> {
  return {
  counters: {
    u_column: 5,
    u_row: 5,
    u_content_text: 4,
    u_content_divider: 1,
  },
  body: {
    rows: [
      // ── Brand header ─────────────────────────────────────────────────
      {
        id: "u_row_1",
        cells: [1],
        columns: [
          {
            id: "u_column_1",
            contents: [
              {
                id: "u_content_text_1",
                type: "text",
                values: {
                  containerPadding: "0px",
                  textAlign: "left",
                  lineHeight: "140%",
                  linkStyle: { inherit: true, body: true },
                  hideMobile: false,
                  displayCondition: null,
                  text: `<p style="margin:0;font-size:18px;line-height:140%;font-weight:600;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Ubuntu,sans-serif">${siteName}</p>`,
                  _meta: { htmlID: "u_content_text_1", htmlClassNames: "u_content_text" },
                },
              },
            ],
            values: {
              backgroundColor: "",
              padding: "0px",
              border: {},
              _meta: { htmlID: "u_column_1", htmlClassNames: "u_column" },
            },
          },
        ],
        values: {
          displayCondition: null,
          columns: false,
          backgroundColor: "#ffffff",
          columnsBackgroundColor: "",
          backgroundImage: { url: "", fullWidth: true, repeat: false, center: true, cover: false },
          padding: "32px 24px 0px",
          hideDesktop: false,
          _meta: { htmlID: "u_row_1", htmlClassNames: "u_row" },
          selectable: true,
          draggable: true,
          duplicatable: true,
          deletable: true,
        },
      },

      // ── Heading + body text ──────────────────────────────────────────
      {
        id: "u_row_2",
        cells: [1],
        columns: [
          {
            id: "u_column_2",
            contents: [
              {
                id: "u_content_text_2",
                type: "text",
                values: {
                  containerPadding: "0px",
                  textAlign: "left",
                  lineHeight: "140%",
                  linkStyle: { inherit: true, body: true },
                  hideMobile: false,
                  displayCondition: null,
                  text: '<h2 style="margin:0 0 20px;font-size:22px;line-height:140%;font-weight:600;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'Helvetica Neue\',Ubuntu,sans-serif">邮件标题</h2><p style="margin:0 0 16px;font-size:16px;line-height:150%;color:#3f3f46;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'Helvetica Neue\',Ubuntu,sans-serif">在此填写邮件正文内容，可以通知活动详情、优惠信息等。</p>',
                  _meta: { htmlID: "u_content_text_2", htmlClassNames: "u_content_text" },
                },
              },
            ],
            values: {
              backgroundColor: "",
              padding: "0px",
              border: {},
              _meta: { htmlID: "u_column_2", htmlClassNames: "u_column" },
            },
          },
        ],
        values: {
          displayCondition: null,
          columns: false,
          backgroundColor: "#ffffff",
          columnsBackgroundColor: "",
          backgroundImage: { url: "", fullWidth: true, repeat: false, center: true, cover: false },
          padding: "24px 24px 8px",
          hideDesktop: false,
          _meta: { htmlID: "u_row_2", htmlClassNames: "u_row" },
          selectable: true,
          draggable: true,
          duplicatable: true,
          deletable: true,
        },
      },

      // ── CTA button ───────────────────────────────────────────────────
      {
        id: "u_row_3",
        cells: [1],
        columns: [
          {
            id: "u_column_3",
            contents: [
              {
                id: "u_content_text_3",
                type: "text",
                values: {
                  containerPadding: "0px",
                  textAlign: "left",
                  lineHeight: "140%",
                  linkStyle: { inherit: true, body: true },
                  hideMobile: false,
                  displayCondition: null,
                  text: '<p style="margin:16px 0 8px"><a href="#" style="display:inline-block;background-color:#0ea5e9;color:#ffffff;padding:14px 24px;border-radius:6px;font-weight:600;font-size:16px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'Helvetica Neue\',Ubuntu,sans-serif">立即查看</a></p>',
                  _meta: { htmlID: "u_content_text_3", htmlClassNames: "u_content_text" },
                },
              },
            ],
            values: {
              backgroundColor: "",
              padding: "0px",
              border: {},
              _meta: { htmlID: "u_column_3", htmlClassNames: "u_column" },
            },
          },
        ],
        values: {
          displayCondition: null,
          columns: false,
          backgroundColor: "#ffffff",
          columnsBackgroundColor: "",
          backgroundImage: { url: "", fullWidth: true, repeat: false, center: true, cover: false },
          padding: "0px 24px 16px",
          hideDesktop: false,
          _meta: { htmlID: "u_row_3", htmlClassNames: "u_row" },
          selectable: true,
          draggable: true,
          duplicatable: true,
          deletable: true,
        },
      },

      // ── Divider ──────────────────────────────────────────────────────
      {
        id: "u_row_4",
        cells: [1],
        columns: [
          {
            id: "u_column_4",
            contents: [
              {
                id: "u_content_divider_1",
                type: "divider",
                values: {
                  width: "100%",
                  border: {
                    borderTopWidth: "1px",
                    borderTopStyle: "solid",
                    borderTopColor: "#e4e4e7",
                  },
                  textAlign: "center",
                  containerPadding: "0px",
                  hideMobile: false,
                  displayCondition: null,
                  _meta: { htmlID: "u_content_divider_1", htmlClassNames: "u_content_divider" },
                },
              },
            ],
            values: {
              backgroundColor: "",
              padding: "0px",
              border: {},
              _meta: { htmlID: "u_column_4", htmlClassNames: "u_column" },
            },
          },
        ],
        values: {
          displayCondition: null,
          columns: false,
          backgroundColor: "#ffffff",
          columnsBackgroundColor: "",
          backgroundImage: { url: "", fullWidth: true, repeat: false, center: true, cover: false },
          padding: "24px 24px 0px",
          hideDesktop: false,
          _meta: { htmlID: "u_row_4", htmlClassNames: "u_row" },
          selectable: true,
          draggable: true,
          duplicatable: true,
          deletable: true,
        },
      },

      // ── Footer ───────────────────────────────────────────────────────
      {
        id: "u_row_5",
        cells: [1],
        columns: [
          {
            id: "u_column_5",
            contents: [
              {
                id: "u_content_text_4",
                type: "text",
                values: {
                  containerPadding: "0px",
                  textAlign: "left",
                  lineHeight: "160%",
                  linkStyle: { inherit: true, body: true },
                  hideMobile: false,
                  displayCondition: null,
                  text: `<p style="margin:0;font-size:12px;line-height:160%;color:#a1a1aa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Ubuntu,sans-serif">${siteName} · 如需取消订阅，请回复此邮件</p>`,
                  _meta: { htmlID: "u_content_text_4", htmlClassNames: "u_content_text" },
                },
              },
            ],
            values: {
              backgroundColor: "",
              padding: "0px",
              border: {},
              _meta: { htmlID: "u_column_5", htmlClassNames: "u_column" },
            },
          },
        ],
        values: {
          displayCondition: null,
          columns: false,
          backgroundColor: "#ffffff",
          columnsBackgroundColor: "",
          backgroundImage: { url: "", fullWidth: true, repeat: false, center: true, cover: false },
          padding: "16px 24px 32px",
          hideDesktop: false,
          _meta: { htmlID: "u_row_5", htmlClassNames: "u_row" },
          selectable: true,
          draggable: true,
          duplicatable: true,
          deletable: true,
        },
      },
    ],

    values: {
      backgroundColor: "#f4f4f5",
      backgroundImage: {
        url: "",
        fullWidth: true,
        repeat: false,
        center: true,
        cover: false,
      },
      contentWidth: "560px",
      contentAlign: "center",
      fontFamily: {
        label: "Helvetica",
        value: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Ubuntu,sans-serif",
      },
      preheaderText: "",
      linkStyle: {
        body: true,
        linkColor: "#0ea5e9",
        linkHoverColor: "#0284c7",
        linkUnderline: true,
        linkHoverUnderline: true,
      },
      _meta: { htmlID: "u_body", htmlClassNames: "u_body" },
    },
  },
  }
}
