const Title = {
    view: function(vnode) {
        const value = (vnode.attrs.doc.title_t || [""])[0];
        if (vnode.attrs.path.endsWith(".txt")) {
            return m(
                "h2",
                value || "Untitled",
                (vnode.attrs.edit)?
                    m("button.btn.btn-link",
                      {onclick: vnode.attrs.edit},
                      m("i.icon.icon-edit")):null);
        }

        function onclick() {
            vnode.state.new_value = value;
            vnode.state.edit = true;
        }

        function oninput(e) {
            vnode.state.new_value = e.target.value;
        }

        function onsubmit(e) {
            e.preventDefault();
            if (vnode.state.new_value !== value) {
                let title = vnode.state.new_value;
                vnode.attrs.patch(
                    (vnode.attrs.doc.title_t)?
                        [{op: "replace", path: "/title_t/0", value: title}]
                    :
                    [{op: "add", path: "/title_t", value: [title]}]);
            }
            vnode.state.edit = false;
        }

        function cancel(e) {
            e.preventDefault();
            vnode.state.edit = false;
        }

        return (vnode.state.edit)?
            m("h2",
              m("form.form-group.input-group", {onsubmit},
                m("input.form-input", {value: vnode.state.new_value, oninput}),
                m("button.btn.btn-primary.input-group-btn[type=submit]", "Save"),
                m("button.btn.input-group-btn", {onclick: cancel}, "Cancel")))
            :
            m("h2",
              value || "Untitled",
              m("button.btn.btn-link", {onclick}, m("i.icon.icon-edit")));
    }
};

export const top_widgets = [Title];
