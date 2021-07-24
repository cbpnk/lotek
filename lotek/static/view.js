import {get_token} from "/static/user.js";

const Action = {
    view: function(vnode) {
        let token = get_token();

        function random_char() {
            return '0123456789abcdef'[Math.floor(Math.random() * 16)];
        }

        function random_name() {
            return random_char() + random_char() + random_char();
        }

        function create_new_file() {
            const path = `${random_name()}/${random_name()}/${random_name()}.txt`;
            m.request(
                {method: "PUT",
                 url: m.buildPathname("/files/:path...", {path}),
                 headers: {'X-Lotek-Date': (new Date()).toUTCString(),
                           'Authorization': token}}
            ).then(
                function (result) {
                    m.route.set(m.buildPathname("/view/:path...", {path}));
                },
                function (error) {
                    if (error.code === 409) {
                        create_new_file()
                    }
                }
            );
        }

        if (token) {
            return m("div.input-group.input-inline",
                     m("button.btn.btn-primary.btn-sm",
                       {onclick: create_new_file},
                       "New"));
        }
    }
}

const View = {
    oninit: function(vnode) {
        vnode.state.edit = false;
        vnode.state.doc = false;
        m.request(
            {method: "GET",
             url: "/files/:path...",
             params: {path: vnode.attrs.path},
             responseType: "json",
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
        let token = get_token();
        if (vnode.state.doc === null) {
            if (!vnode.state.edit) {
                function onclick() {
                    m.request(
                        {method: "PUT",
                         url: "/files/home.txt",
                         params: {path: vnode.attrs.path},
                         headers: {'X-Lotek-Date': (new Date()).toUTCString(),
                                   'Content-Type': "application/json",
                                   'Authorization': token},
                         body: {"title_t": ["Home"]}}
                    ).then(
                        function(result) {
                            vnode.state.doc = result.response;
                            vnode.state.etag = result.etag;
                            m.redraw();
                        },
                        function(error) {
                            console.log(error);
                        }
                    )
                }

                return [
                    m("main",
                      (vnode.attrs.path !== 'home.txt')?"NOT FOUND":
                      m("div.empty",
                        m("div.empty-action",
                          token?m("button.btn.btn-primary", {onclick}, "Create Home Page"):null
                         )
                       )
                     )
                ];
            } else {
                return [
                    m("main", "NOT FOUND")
                ];
            }
        }
        if (vnode.state.doc === false) {
            return [
                m("main", m("div.loading.loading-lg")),
            ];
        }

        function save() {
            m.request(
                {method: "POST",
                 url: "/files/:path...",
                 params: {path: vnode.attrs.path},
                 headers: {'X-Lotek-Date': (new Date()).toUTCString(),
                           'Authorization': token},
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
                 headers: {'If-Match': vnode.state.etag,
                           'X-Lotek-Date': (new Date()).toUTCString(),
                           'Authorization': token},
                 body: body,
                 responseType: "json",
                 extract: function(xhr) { return {etag: xhr.getResponseHeader("ETag"), response: xhr.response}; }
                }
            ).then(
                function (result) {
                    vnode.state.doc = result.response;
                    vnode.state.etag = result.etag;
                    m.redraw();
                    return vnode.state.doc;
                },
                function (error) {
                    console.log(error);
                }
            );
        }

        function show_edit() {
            vnode.state.edit = true;
        }

        function hide_edit() {
            vnode.state.edit = false;
        }

        return (vnode.state.edit)?m(registry.editor_widgets[0],{hide: hide_edit, patch, save, path: vnode.attrs.path, doc: vnode.state.doc}):[
            m("main",
              m("iframe",
                {style: `margin: 0; border: 0; padding: 0; width: 100%; height: 100%;`,
                 src: m.buildPathname("/files/:path...", {path: vnode.attrs.path})
                })
             ),
            m("aside.top",
              m("h2",
                m(Title, {doc: vnode.state.doc}),
                (!token)?null:
                m("button.btn.btn-link",
                  {onclick: show_edit},
                  m("i.icon.icon-edit")))
             ),
            [
             ["aside.bottom", registry.bottom_widgets],
             ["aside.left", registry.left_widgets],
             ["aside.right", registry.right_widgets]
            ].map(
                ([component, widgets]) =>
                m(component, widgets.map(
                    (widget) =>
                    m(widget,
                      {patch: (token)?patch:undefined,
                       path: vnode.attrs.path,
                       doc:vnode.state.doc})))
            )
        ];
    }
};

export const routes = {
    "/view/:path...": (vnode) => m(View, {key: m.route.get(), path: vnode.attrs.path})
};

export const links = [{url: "/view/home.txt", name: "Home"}];
export const actions = [Action];

export const registry = {
    editor_widgets: [],
    left_widgets: [],
    right_widgets: [],
    bottom_widgets: []
};

export const Title = {
    view: function (vnode) {
        if (vnode.attrs.doc) {
            return (vnode.attrs.doc.title_t || ["Untitled"])[0];
        }
        return vnode.attrs.path;
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
