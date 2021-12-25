const Widget = {
    view(vnode) {
        const new_categories = Object.entries(registry.categories).filter(
            ([key, value]) => !(vnode.attrs.file.category_s || []).includes(key));

        function new_category(key) {
            return function() {
                vnode.attrs.patch(
                    (vnode.attrs.file.category_s)?
                    [{op: "add", path: "/category_s/-", value: key}]
                    :
                    [{op: "add", path: "/category_s", value: [key]}],
                    {'Subject': `Add category ${key}`}
                );
            }
        }

        function delete_category(key) {
            return function() {
                const ops = [
                    {op: "remove",
                     path: `/category_s/${vnode.attrs.file.category_s.indexOf(key)}`}
                ];

                if (vnode.attrs.file[key]) {
                    ops.push(
                        {op: "remove",
                         path: `/${key}`
                        }
                    );
                }

                vnode.attrs.patch(ops, {'Subject': `Remove category ${key}`});
            }
        }

        function patch(category) {
            return function(ops, headers) {
                ops.forEach(
                    function (op) {
                        op.path = `/${category}${op.path}`
                    }
                );

                if (!vnode.attrs.file[category]) {
                    ops.unshift({op: "add", path: `/${category}`, value: {}});
                }

                return vnode.attrs.patch(ops, headers);
            }
        }

        return m("details", {open: true},
                 m("summary", {style: "float: left;"}, "CATEGORY"),
                 m(CUI.PopoverMenu,
                   {closeOnContentClick: true,
                    trigger:
                    m(CUI.Icon, {name: CUI.Icons.PLUS, style: "float: right;"}),
                    content: new_categories.map(
                        ([key, value]) =>
                        m(CUI.MenuItem,
                          {label: value.name,
                           onclick: new_category(key)})
                    )
                   }),
                 m(".container", {style: "clear: both; padding: 0 0 0 1em;"},
                   Object.entries(registry.categories).filter(
                       ([key, value]) => (vnode.attrs.file.category_s || []).includes(key)).map(
                           ([key, value]) =>
                           m("details", {open: true},
                             m("summary", {style: "float: left;"}, value.name),
                             m("", {style: "float: right;"}, m(CUI.Icon, {name: CUI.Icons.X, onclick: delete_category(key)})),
                             m("", {style: "clear: both; padding: 0 0 0 1em;"},
                               m(value.component,
                                 {id: vnode.attrs.id,
                                  file: vnode.attrs.file,
                                  patch: patch(key)}
                                )
                              )
                            )
                       )
                  )
                );
    }
};

export const registry = {categories: {}};
export const widgets = [Widget];
