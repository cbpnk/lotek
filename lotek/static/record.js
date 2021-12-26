import {SearchBar} from "/static/search.js";

function update_record(vnode, result) {
    const record = result.response;
    vnode.state.etag = result.etag;
    if (result.allow) {
        vnode.state.allow = result.allow.split(",").map((s) => s.trim());
    }
    vnode.state.record = record;
}

const Record = {
    oninit(vnode) {
        document.title = vnode.attrs.id;
        vnode.state.record = null;

        request(
            {method: "GET",
             url: "/:id",
             params: {id: vnode.attrs.id},
             responseType: "json",
             extract(xhr) { return {
                 etag: xhr.getResponseHeader("ETag"),
                 allow: xhr.getResponseHeader("X-Lotek-Allow"),
                 response: xhr.response}; }
            }
        ).then(
            function(result) {
                update_record(vnode, result);
            },
            function(error) {
                if (error.code === 404) {
                    vnode.state.record = false;
                }
            }
        );
    },

    view(vnode) {
        const record = vnode.state.record;
        if (record === null) {
            return m(".container", {style: "position: relative;"},
                     m(CUI.EmptyState,
                       {icon: CUI.Icons.LOADER,
                        header: "Loading ..."}));
        }

        if (record === false) {
            return m(".container", {style: "position: relative;"},
                     m(CUI.EmptyState,
                       {icon: CUI.Icons.ALERT_CIRCLE,
                        header: "Record not found",
                        content: m(SearchBar)}
                      ));
        }

        async function patch(body, headers) {
            headers = headers || {};
            headers['If-Match'] = vnode.state.etag;
            const result = await request(
                {method: "PATCH",
                 url: "/:id",
                 params: {id: vnode.attrs.id},
                 headers,
                 body,
                 responseType: "json",
                 extract(xhr) { return {etag: xhr.getResponseHeader("ETag"), response: xhr.response}; }
                }
            );
            update_record(vnode, result);
        };

        return m(".container", {style: "position: relative;"},
                 m(registry.types[record.type],
                   {id: vnode.attrs.id,
                    record: vnode.state.record,
                    allow: vnode.state.allow || [],
                    patch})
                );
    }
};

export const routes = [
    ["/:id", (vnode) => m(Record, {key: vnode.attrs.id, id: vnode.attrs.id})],
];

export const registry = {
    types: {},
};
