import {get_token} from "/static/auth.js";

function update_doc(vnode, result) {
    vnode.state.doc = result.response;
    vnode.state.etag = result.etag;
    document.title = (vnode.state.doc.title_t || [vnode.attrs.path])[0];
    m.redraw();
}

const View = {
    oninit: function(vnode) {
        document.title = vnode.attrs.path;
        vnode.state.edit = false;
        vnode.state.doc = false;
        m.request(
            {method: "GET",
             url: "/:path...",
             params: {path: vnode.attrs.path},
             responseType: "json",
             extract: function(xhr) { return {etag: xhr.getResponseHeader("ETag"), response: xhr.response}; }}
        ).then(
            function (result) {
                update_doc(vnode, result);
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
            return [
                m("main", "NOT FOUND")
            ];
        }
        if (vnode.state.doc === false) {
            return [
                m("main", m("div.loading.loading-lg")),
            ];
        }

        function save() {
            m.request(
                {method: "POST",
                 url: "/:path",
                 params: {path: vnode.attrs.path},
                 headers: {'X-Lotek-Date': (new Date()).toUTCString(),
                           'Authorization': `Bearer ${token}`},
                 responseType: "json",
                 extract: function(xhr) { return {etag: xhr.getResponseHeader("ETag"), response: xhr.response}; }
                }
            ).then(
                function (result) {
                    vnode.state.edit = false;
                    update_doc(vnode, result);
                    return vnode.state.doc;
                },
                function (error) {
                    console.log(error);
                }
            );
        }

        function patch(body) {
            return m.request(
                {method: "PATCH",
                 url: "/:path",
                 params: {path: vnode.attrs.path},
                 headers: {'If-Match': vnode.state.etag,
                           'X-Lotek-Date': (new Date()).toUTCString(),
                           'Authorization': `Bearer ${token}`},
                 body: body,
                 responseType: "json",
                 extract: function(xhr) { return {etag: xhr.getResponseHeader("ETag"), response: xhr.response}; }
                }
            ).then(
                function (result) {
                    update_doc(vnode, result);
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

        if (vnode.state.edit) {
            return m(registry.editor_widgets[0],
                     {hide: hide_edit,
                      patch, save,
                      path: vnode.attrs.path,
                      doc: vnode.state.doc});
        }

        return [
            m("main",
              m("iframe",
                {style: "margin: 0; border: 0; padding: 0; width: 100%; min-height: calc(100% - 2em);",
                 onload: function(event) {
                     event.target.contentWindow.location.hash = window.location.hash;
                     if (event.target.scrollHeight < event.target.contentDocument.body.scrollHeight) {
                         event.target.style.height = event.target.contentDocument.body.scrollHeight + "px";
                     }
                     const script = event.target.contentDocument.createElement("script");
                     script.src = event.target.contentWindow.hypothesisConfig().services[0].assetRoot + "build/boot.js";
                     event.target.contentDocument.head.appendChild(script);

                 },
                 srcdoc: vnode.state.doc.html,
                 key: token || "anonymous"
                }
               )
             ),
            [
             ["aside.top", registry.top_widgets],
             ["aside.bottom", registry.bottom_widgets],
             ["aside.left", registry.left_widgets],
             ["aside.right", registry.right_widgets]
            ].map(
                ([component, widgets]) =>
                m(component, widgets.map(
                    (widget) =>
                    m(widget,
                      {patch: (token)?patch:undefined,
                       edit: (token)?show_edit:null,
                       path: vnode.attrs.path,
                       doc:vnode.state.doc})))
            )
        ];
    }
};

export const routes = {
    "/:path.txt": (vnode) => m(View, {key: m.route.get(), path: `${vnode.attrs.path}.txt`}),
    "/~:username": (vnode) => m(View, {key: m.route.get(), path: `~${vnode.attrs.username}`})
};


export const registry = {
    editor_widgets: [],
    top_widgets: [],
    bottom_widgets: [],
    left_widgets: [],
    right_widgets: [],
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
        const path = vnode.attrs.doc.path;
        if (path.includes("#")) {
            return m("a",
                     {href: '/' + path,
                      "class": vnode.attrs.class},
                     (vnode.attrs.doc.title_t || [path])[0]);
        }
        return m(m.route.Link,
                 {href: m.buildPathname("/:path", {path: path}),
                  "class": vnode.attrs.class},
                 (vnode.attrs.doc.title_t || [path])[0]);
    }
}
