import {get_token} from "/static/layout.js";

const Action = {
    view: function(vnode) {
        function random_char() {
            return '0123456789abcdef'[Math.floor(Math.random() * 16)];
        }

        function random_name() {
            return random_char() + random_char() + random_char();
        }

        function create_new_file() {
            const path = `${random_name()}/${random_name()}/${random_name()}.md`;
            m.request(
                {method: "PUT",
                 url: m.buildPathname("/files/:path...", {path}),
                 headers: {'X-Lotek-Date': (new Date()).toUTCString(), 'Authorization': get_token()}}
            ).then(
                function (result) {
                    m.route.set(m.buildPathname("/edit/:path...", {path}));
                },
                function (error) {
                    if (error.code === 409) {
                        create_new_file()
                    }
                }
            );
        }

        return m("div.input-group.input-inline",
                 m("button.btn.btn-primary.btn-sm", {onclick: create_new_file}, "New"));
    }
}

const Markdown = {
    oninit: function(vnode) {
        vnode.state.doc = false;
        m.request(
            {method: "GET",
             url: "/files/:path...",
             params: {path: vnode.attrs.path},
             responseType: "json",
             headers: {'Authorization': get_token()},
             extract: function(xhr) { return {etag: xhr.getResponseHeader("ETag"), response: xhr.response}; }}
        ).then(
            function (result) {
                vnode.state.doc = result.response;
                vnode.state.etag = result.etag;
                m.redraw();
            },
            function (error) {
                if (error.code == 404) {
                    vnode.state.doc = null;
                    m.redraw();
                }
            }
        );
    },

    view: function(vnode) {
        if (vnode.state.doc === null) {
            if (!vnode.attrs.edit) {
                function onclick() {
                    m.request(
                        {method: "PUT",
                         url: "/files/home.md",
                         params: {path: vnode.attrs.path},
                         headers: {'X-Lotek-Date': (new Date()).toUTCString(), 'Content-Type': "application/json", 'Authorization': get_token()},
                         body: {"title_t": ["Home"]}}
                    ).then(
                        function(result) {
                            m.route.set("/edit/home.md");
                        },
                        function(error) {
                            console.log(error);
                        }
                    )
                }

                return [
                    m("main", (vnode.attrs.path === 'home.md')?m("button", {onclick}, "Create Home Page"):"NOT FOUND"),
                    m("aside.top", []),
                    m("aside.bottom", []),
                    m("aside.right", [])
                ];
            } else {
                return [
                    m("main", "NOT FOUND"),
                    m("aside.top", []),
                    m("aside.bottom", []),
                    m("aside.right", [])
                ];
            }
        }
        if (vnode.state.doc === false) {
            return [
                m("main", m("div[uk-spinner]")),
                m("aside.top"),
                m("aside.bottom"),
                m("aside.right")
            ];
        }

        function save() {
            m.request(
                {method: "POST",
                 url: "/files/:path...",
                 params: {path: vnode.attrs.path},
                 headers: {'X-Lotek-Date': (new Date()).toUTCString(), 'Authorization': get_token()},
                 responseType: "json",
                 extract: function(xhr) { return {etag: xhr.getResponseHeader("ETag"), response: xhr.response}; }
                }
            ).then(
                function (result) {
                    m.route.set(m.buildPathname("/view/:path...", {path: vnode.attrs.path}));
                },
                function (error) {
                    console.log(error);
                }
            );
        }

        function patch(body) {
            return m.request(
                {method: "PATCH",
                 url: "/files/:path...",
                 params: {path: vnode.attrs.path},
                 headers: {'If-Match': vnode.state.etag, 'X-Lotek-Date': (new Date()).toUTCString(), 'Authorization': get_token()},
                 body: body,
                 responseType: "json",
                 extract: function(xhr) { return {etag: xhr.getResponseHeader("ETag"), response: xhr.response}; }
                }
            ).then(
                function (result) {
                    vnode.state.doc = result.response;
                    vnode.state.etag = result.etag;
                    m.redraw();
                },
                function (error) {
                    console.log(error);
                }
            );
        }

        const edit = vnode.attrs.edit;

        return (edit)?m(registry.editor_widgets[0], {edit, patch, save, path: vnode.attrs.path, doc: vnode.state.doc}):[
            m("main", m.trust(vnode.state.doc.html)),
            [["aside.top", registry.top_widgets],
             ["aside.bottom", registry.bottom_widgets],
             ["aside.right", registry.right_widgets]
            ].map(
                ([component, widgets]) =>
                m(component, widgets.map((widget) => m(widget, {edit, patch, save, path: vnode.attrs.path, doc:vnode.state.doc})))
            )
        ];
    }
};

export const routes = {
    "/view/:path...": (vnode) => m(Markdown, {key: m.route.get(), path: vnode.attrs.path, edit: false}),
    "/edit/:path...": (vnode) => m(Markdown, {key: m.route.get(), path: vnode.attrs.path, edit: true})
};

export const links = [{url: "/view/home.md", name: "Home"}];
export const actions = [Action];

export const registry = {
    editor_widgets: [],
    left_widgets: [],
    right_widgets: [],
    top_widgets: [],
    bottom_widgets: []
};

export const Title = {
    view: function (vnode) {
        return (vnode.attrs.doc.title_t || ["Untitled"])[0];
    }
};

export const Link = {
    view: function (vnode) {
        return m(m.route.Link,
                 {href: m.buildPathname("/view/:path...", {path: vnode.attrs.doc.path}),
                  "class": vnode.attrs.class},
                 (vnode.attrs.doc.title_t || ["Untitled"])[0]);
    }
}
