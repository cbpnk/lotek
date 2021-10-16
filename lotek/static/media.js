const Widget = {
    view: function(vnode) {
        for (let ext of ["pdf", "maff"]) {
            if ((vnode.attrs.doc.category_i || []).includes(ext)) {
                let url = `/${vnode.attrs.path.slice(0, -ext.length)}.${ext}`;
                function onclick() {
                    m.request({method: "OPEN", url});
                }
                return [
                    m("h4", "Media"),
                    m(CUI.ButtonGroup,
                      m(CUI.Button,
                        {label: "View",
                         intent: "primary",
                         onclick: () => m.route.set(url)}),
                      m(CUI.Button,
                        {label: "Open Containing Folder",
                         onclick}))
                ];
            }
        }
    }
};

export const right_widgets = [Widget];
