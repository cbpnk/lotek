const Layout = {
    view: function(vnode) {
        function nav_link(link, name) {
            return m("li.tab-item", {"class": (path===link?"active":"")}, m(m.route.Link, {href: link}, name));
        }

        const path = window.location.pathname;

        return [
            vnode.children,
            m("header",
              m("ul.tab",
                registry.links.map(
                    (link) =>
                    m("li.tab-item",
                      {"class": (path===link.url?"active":"")},
                      m(m.route.Link, {href: link.url}, link.name))
                ),
                m("li.tab-item.tab-action",
                  registry.actions.map((action) => m(action, {})))
               )
             ),
            m("footer.py-2")
        ];
    }
};

function authenticate(args, requestedPath, route) {
    if (!authenticated) {
        return Authenticate;
    }
}

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
                      return (vnode.tag !== "div")?vnode:m(Layout, value(vnode));
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
