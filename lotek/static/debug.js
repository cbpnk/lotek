const Debug = {
    oninit: function(vnode) {
        vnode.state.active = false;
        vnode.state.value = "";
        vnode.state.disabled = true;
    },

    view: function(vnode) {
        function oninput(event) {
            vnode.state.value = event.target.value;
            vnode.state.disabled = true;
            try {
                JSON.parse(vnode.state.value);
                vnode.state.disabled = false;
            } catch(e) {
            }
        }

        function onclick() {
            vnode.attrs.patch(JSON.parse(vnode.state.value));
        }

        let doc = {};
        Object.assign(doc, vnode.attrs.file);
        delete doc.content;
        delete doc.html;

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

        return m("div.column-flex.container",
                 m(CUI.TextArea,
                   {oninput: oninput,
                    value: vnode.state.value}),
                 m(CUI.Button,
                   {label: "PATCH",
                    intent: "primary",
                    disabled: vnode.state.disabled,
                    onclick: onclick}),
                 m("iframe.container",
                   {style: "border: none;",
                    srcdoc: srcdoc})
                );
    }
}

function is_debug_available(file, allow) {
    return true;
}

export const modes = [
    {name: "debug",
     label: "Debug",
     is_available: is_debug_available,
     component: Debug}
];
