const Debug = {
    oninit: function(vnode) {
        vnode.state.active = false;
        vnode.state.value = "";
        vnode.state.disabled = "disabled";
    },

    view: function(vnode) {
        function oninput(event) {
            vnode.state.value = event.target.value;
            vnode.state.disabled = "disabled";
            try {
                JSON.parse(vnode.state.value);
                vnode.state.disabled = "";
            } catch(e) {
            }
        }

        function onclick() {
            vnode.attrs.patch(JSON.parse(vnode.state.value));
        }

        let doc = {};
        Object.assign(doc, vnode.attrs.doc);
        delete doc.content;

        let srcdoc = `<!doctype html>
<html class="theme-light" dir="ltr">
<head>
<link rel="stylesheet" type="text/css" href="chrome://devtools-jsonview-styles/content/main.css">
<script type="text/javascript">
var JSONView = {
  debugJsModules: false,
  headers: {request: [], response: []},
  Locale: {
    "jsonViewer.Copy": "复制",
    "jsonViewer.requestHeaders": "请求头",
    "jsonViewer.CollapseAll": "全部折叠",
    "jsonViewer.PrettyPrint": "美化输出",
    "jsonViewer.tab.Headers": "头",
    "jsonViewer.ExpandAll": "全部展开",
    "jsonViewer.tab.RawData": "原始数据",
    "jsonViewer.tab.JSON": "JSON",
    "jsonViewer.responseHeaders": "响应头",
    "jsonViewer.ExpandAllSlow": "全部展开（慢）",
    "jsonViewer.filterJSON": "过滤 JSON",
    "jsonViewer.Save": "保存"
  },
  json: document.createTextNode(${JSON.stringify(JSON.stringify(doc))}),
};
</script>
</head>
<body>
<div id="content"></div>
<script src="resource://devtools-client-jsonview/lib/require.js" data-main="resource://devtools-client-jsonview/viewer-config.js"></script>
</body>
</html>`;

        return (vnode.attrs.patch)?m("div.off-canvas",
                 m("button.off-canvas-toggle.btn.btn-primary",
                   {onclick: function() {vnode.state.active=true;}},
                   "Debug"),
                 (!vnode.state.active)?null:
                 m("div.off-canvas-sidebar.d-flex.active",
                   {"style": "flex-direction: column;"},
                   m("textarea", {oninput}, vnode.state.value),
                   m("button.btn.btn-sm.btn-primary",
                     {onclick, disabled: vnode.state.disabled}, "PATCH"),
                   m("iframe", {"style": "margin: 0; padding: 0; border: none; height: 100%;", srcdoc})
                  ),
                 m("button.off-canvas-overlay",
                   {onclick: function() {vnode.state.active=false;}},
                   m("i.icon.icon-arrow-left")
                  )
                ):null;
    }
}

export const left_widgets = [Debug];
