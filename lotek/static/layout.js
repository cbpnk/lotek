const Layout = {
    view: function(vnode) {
        const path = window.location.pathname;

        return [
            vnode.children,
            m("header",
              m(CUI.Tabs,
                {align: "left",
                 bordered: true},
                registry.links.map(
                    (link) =>
                    m(CUI.TabItem,
                      {label: link.name,
                       active: path == link.url,
                       onclick: () => m.route.set(link.url)})
                ),
                m(CUI.ControlGroup,
                  {style: 'flex-grow: 1; justify-content: flex-end'},
                  registry.actions.map((action) => m(action)))
               )
             ),
            m("footer.py-2")
        ];
    }
};

function main() {
    m.route.prefix = "";
    m.route(
        document.body,
        registry.links[0].url,
        Object.fromEntries(
            Object.entries(registry.routes).map(
                ([key, value]) =>
                [key,
                 {render: function(vnode) {
                      return m(Layout, value(vnode));
                  }}]
            ))
    );
}

export const registry = {
    routes: {},
    links: [],
    actions: []
};

export const onload = [main];
