var authenticated = localStorage.getItem('token');

const Authenticate = {
    oninit: function(vnode) {
        vnode.state.email = '';
        vnode.state.password = '';
        vnode.state.error = false;
    },

    view: function(vnode) {
        function onsubmit(e) {
            e.preventDefault();
            m.request(
                {method: "POST",
                 url: "/authenticate",
                 body: {email: vnode.state.email, password: vnode.state.password},
                }
            ).then(
                function(result) {
                    authenticated = result;
                    localStorage.setItem('token', result);
                    m.route.set(m.route.get(), {}, {replace: true});
                },
                function(error) {
                    vnode.state.error = "Sign in failed";
                    m.redraw();
                }
            );
        }

        return m(
            "div.modal.active",
            m("div.modal-container",
              m("div.modal-header",
                m("div.modal-title", "Sign in")
               ),
              m("div.modal-body",
                m("form", {onsubmit},
                  (!vnode.state.error)?null:m("div.toast.toast-error", vnode.state.error),
                  m("div.form-group",
                    m("label.form-label", "Email"),
                    m("input.form-input[type=email]",
                      {oninput: function(e) { vnode.state.email = e.target.value; },
                       value: vnode.state.email})
                   ),
                  m("div.form-group",
                    m("label.form-label", "Password"),
                    m("input.form-input[type=password]",
                      {oninput: function(e) { vnode.state.password = e.target.value; },
                       value: vnode.state.password}),
                   ),
                  m("div.form-group",
                    m("button.form-input.btn.btn-primary", "Submit")
                   )
                 )
               )
             )
        );
    }
}


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
                  registry.actions.map((action) => m(action)))
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
                 {onmatch: authenticate,
                  render: function(vnode) {
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

export function get_token() {
    if (authenticated)
        return `Bearer ${authenticated}`;
}
