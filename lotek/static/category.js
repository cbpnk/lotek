const CategoryTabs = {
    oninit: function(vnode) {
        vnode.state.active = (vnode.attrs.doc.category_i || [])[0];
    },

    view: function(vnode) {
        const new_categories = Object.entries(registry.categories).filter(
            ([key, value]) => !(vnode.attrs.doc.category_i || []).includes(key) && !value.readonly);

        function delete_category(category) {
            return function() {
                vnode.state.active = undefined;
                vnode.attrs.patch(
                    [{op: "remove",
                      path: `/category_i/${vnode.attrs.doc.category_i.indexOf(category)}`}
                    ].concat(
                        (registry.categories[category].attributes || []).filter(
                            (attr) =>
                            (vnode.attrs.doc[attr] || []).length > 0).map(
                                (attr) => ({op: "remove", path: `/${attr}`}))
                    )).then(
                        function(doc) {
                            vnode.state.active = (doc.category_i || [])[0];
                        }
                    );
            }
        }

        function new_category(key) {
            return function() {
                vnode.attrs.patch(
                    (vnode.attrs.doc.category_i)?
                    [{op: "add", path: "/category_i/-", value: key}]
                    :
                    [{op: "add", path: "/category_i", value: [key]}]
                ).then(
                    function(doc) {
                        if (!vnode.state.active)
                            vnode.state.active = (doc.category_i || [])[0];
                    }
                );
            }
        }

        function set_active(key) {
            return function() {
                vnode.state.active = key;
            }
        }

        return [
            m("ul.tab",
              (vnode.attrs.doc.category_i || []).map(
                  (category) =>
                  m("li.tab-item",
                    {"class": (vnode.state.active == category)?"active":""},
                    m("a",
                      {onclick: set_active(category)},
                      registry.categories[category].name,
                      (vnode.attrs.patch && !registry.categories[category].readonly)?m("button.btn.btn-clear", {onclick: delete_category(category)}):null)
                   )
              ),
              vnode.attrs.patch?html`
<li class="tab-item tab-action">
  <div class="dropdown">
    <span class="btn btn-link dropdown-toggle" tabindex="0">
      <i class="icon icon-plus" />
    </span>
    <ul class="menu text-left">
    ${ new_categories.map(
         ([key, value]) => html`
         <li class="menu-item">
           <button class="btn btn-link" onclick=${ new_category(key) }>
           ${ value.name }
           </button>
         </li>`) }
    </ul>
  </div>
</li>`:null),
            (vnode.state.active && registry.categories[vnode.state.active].component)?
                m(registry.categories[vnode.state.active].component,
                  {key: vnode.attrs.active, doc: vnode.attrs.doc, patch: vnode.attrs.patch, path: vnode.attrs.path})
                :null
        ]
    }
};


export const registry = {categories: {}};
export const left_widgets = [CategoryTabs];
