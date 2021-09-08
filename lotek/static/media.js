const Widget = {
    view: function(vnode) {
        function onclick() {
            m.request(
                {method: "OPEN",
                 url: `/${vnode.attrs.path.slice(0,-4)}.pdf`
                }
            );
        }

        if ((vnode.attrs.doc.category_i || []).includes("pdf")) {
            return [
                m("div.divider", {"data-content": "Media"}),
                m("button.btn.btn-primary.btn-sm", {onclick}, "Open Containing Folder")
            ];
        }
    }
};

export const right_widgets = [Widget];
