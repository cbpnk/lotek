const Debug = {
    oninit: function(vnode) {
        vnode.state.active = false;
        vnode.state.value = "";
        vnode.state.disabled = true;
    },

    view: function(vnode) {
        function oninput(event) {
            vnode.state.value = event.target.value;
            console.log(vnode.state.value);
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
        Object.assign(doc, vnode.attrs.doc);
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

        return (!vnode.attrs.patch)?null:
            [
                m(CUI.Button,
                  {label: "Debug",
                   onclick: () => {vnode.state.active = true;}}),
                m(CUI.Drawer,
                  {isOpen: vnode.state.active,
                   position: "left",
                   onClose: () => {vnode.state.active = false},
                   content: [
                       m(CUI.TextArea,
                         {oninput: oninput,
                          value: vnode.state.value}),
                       m(CUI.Button,
                         {label: "PATCH",
                          intent: "primary",
                          disabled: vnode.state.disabled,
                          onclick: onclick}),
                       m("iframe",
                         {style: "margin: 0; padding: 0; border: none; height: 100%;",
                          srcdoc: srcdoc})
                   ]
                  }
                 )
            ];
    }
}

export const left_widgets = [Debug];
