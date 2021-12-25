const View = {
    oninit(vnode) {
        vnode.state.data = null;
        request(
            {method: "POST",
             url: "/:id",
             params: {id: vnode.attrs.id, action: "view"},
             headers: {"X-WOPI-Override": "X-LOTEK-EMBED"},
             responseType: "text"
            }
        ).then(
            function(result) {
                vnode.state.data = result;
            },
            function(error) {
                console.log(error);
            }
        )
    },

    view(vnode) {
        if (vnode.state.data === null) {
            return m(CUI.EmptyState,
                     {icon: CUI.Icons.LOADER,
                      header: "Loading ..."});
        }

        return m("iframe.container",
                 {style: "border: 0; position: absolute;",
                  srcdoc: vnode.state.data
                 });
    }
};

function is_view_available(file, allow) {
    return allow.includes("view");
}

const Edit = {
    oninit(vnode) {
        vnode.state.data = null;
        request(
            {method: "POST",
             url: "/:id",
             params: {id: vnode.attrs.id, action: "edit"},
             headers: {"X-WOPI-Override": "X-LOTEK-EMBED"},
             responseType: "text"
            }
        ).then(
            function(result) {
                vnode.state.data = result;
            },
            function(error) {
                console.log(error);
            }
        )
    },

    view(vnode) {
        if (vnode.state.data === null) {
            return m(CUI.EmptyState,
                     {icon: CUI.Icons.LOADER,
                      header: "Loading ..."});
        }

        return m("iframe.container",
                 {style: "border: 0; position: absolute;",
                  srcdoc: vnode.state.data
                 });
    }
};

function is_edit_available(file, allow) {
    return allow.includes("edit");
}


export const modes = [
    {label: "View",
     is_available: is_view_available,
     component: View},
    {label: "Edit",
     is_available: is_edit_available,
     component: Edit}
];
