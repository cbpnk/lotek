const Widget = {
    view: function(vnode) {
        for (let ext of ["pdf", "maff"]) {
            if ((vnode.attrs.doc.category_i || []).includes(ext)) {
                let url = `/${vnode.attrs.path.slice(0, -ext.length)}.${ext}`;
                function onclick() {
                    m.request({method: "OPEN", url});
                }
                return [
                    m("div.divider", {"data-content": "Media"}),
                    m("div.btn-group.btn-group-block",
                      m(m.route.Link, {"class": "btn btn-primary btn-sm", href: url}, "View"),
                      m("button.btn.btn-sm", {onclick}, "Open Containing Folder"))
                ];
            }
        }
    }
};

export const right_widgets = [Widget];
