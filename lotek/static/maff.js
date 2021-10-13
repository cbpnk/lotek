import {Reload} from "/static/reload.js";

const MAFFForm = {
    view: function(vnode) {
        return m("dl.text-small",
                 m("dt", "Origin"),
                 m("dd.ml-2", m("a", {href: vnode.attrs.doc.maff__originalurl_i}, vnode.attrs.doc.maff__originalurl_i)),
                 m("dt", "Archive Time"),
                 m("dd.ml-2", vnode.attrs.doc.maff__archive_d)
                );
    }
}

class View extends Reload {
    load(vnode) {
        return () => m.request(
            {method: "GET",
             url: "/:path",
             params: {path: vnode.attrs.path},
             headers: {
                 "Accept": "text/html"
             },
             responseType: "text",
            }
        );
    }

    render(doc) {
        return [
            m("iframe",
              {style: "grid-column: 1 / span 3; height: 100%; grid-row: 3; border: 0px; padding: 0; margin: 0;",
               srcdoc: doc,
               onload: function(event) {
                   event.target.contentWindow.location.hash = window.location.hash;
                   const script = event.target.contentDocument.createElement("script");
                   script.src = event.target.contentWindow.hypothesisConfig().services[0].assetRoot + "build/boot.js";
                   event.target.contentDocument.head.appendChild(script);
               }
              }
             )
        ];
    }
}

export const routes = {
    "/:path.maff": (vnode) => m(View, {key: m.route.get(), path: `${vnode.attrs.path}.maff`}),
}

export const searches = [{name: "MAFFs", query: "category_i:maff"}];
export const categories = {
    maff: {
        name: "MAFF",
        component: MAFFForm,
        readonly: true}
};
