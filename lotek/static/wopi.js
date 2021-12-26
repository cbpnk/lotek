const View = {
    oninit(vnode) {
        vnode.state.data = null;
        request(
            {method: "POST",
             url: "/:id",
             params: {id: vnode.attrs.id, action: "view"},
             headers: {"X-WOPI-Override": "X-LOTEK-EMBED"},
            }
        ).then(
            function(result) {
                vnode.state.data = result;
            },
            function(error) {
                console.log(error);
            }
        );
    },

    onremove(vnode) {
        if (vnode.state.listener)
            window.removeEventListener('message', vnode.state.listener);
    },

    onupdate(vnode) {
        const data = vnode.state.data;
        if (!data)
            return;

        const iframe = vnode.dom;

        if (iframe.tagName !== "IFRAME")
            return;

        if (!vnode.state.listener) {
            vnode.state.listener = function(event) {
                if (event.source !== vnode.dom.contentWindow[0])
                    return;
                if (event.data.jsonrpc !== '2.0')
                    return;
                if (event.data.method !== "requestConfig")
                    return;

                const result = {
                    services: [
                        {apiUrl: `${window.location.origin}/hypothesis/api/`,
                         grantToken: data.access_token,
                         sentry: {enabled: false}}
                    ]
                };
                const annotFragmentMatch = window.location.hash.match(
                    /^#annotations:([A-Za-z0-9_-]+)$/
                );
                if (annotFragmentMatch) {
                    result.annotations = annotFragmentMatch[1];
                }

                event.source.postMessage(
                    {jsonrpc: '2.0',
                     id: event.data.id,
                     result
                    },
                    event.origin
                );
            }
            window.addEventListener(
                'message',
                vnode.state.listener);
        }

        const doc = iframe.contentDocument;
        if (doc?.URL === 'about:blank') {
            const form = doc.createElement('form');
            form.method = 'POST';
            form.action = data.client_url;
            const access_token = doc.createElement('input');
            access_token.type = "hidden";
            access_token.name = "access_token";
            access_token.value = data.access_token;
            form.appendChild(access_token);

            const access_token_ttl = doc.createElement('input');
            access_token_ttl.type = "hidden";
            access_token_ttl.name = "access_token_ttl";
            access_token_ttl.value = data.access_token_ttl;
            form.appendChild(access_token_ttl);
            doc.body.appendChild(form);

            for (const [key, value] of data.params) {
                const input = doc.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = value;
                form.appendChild(input);
            }

            form.submit();
            return;
        }
    },

    view(vnode) {
        if (vnode.state.data === null) {
            return m(CUI.EmptyState,
                     {icon: CUI.Icons.LOADER,
                      header: "Loading ..."});
        }

        return m("iframe.container",
                 {style: "border: 0; position: absolute;",
                 });
    }
};

function is_view_available(file, allow) {
    return allow.includes("view");
}

const Edit = {
    oninit(vnode) {
        vnode.state.data = null;
        request(
            {method: "POST",
             url: "/:id",
             params: {id: vnode.attrs.id, action: "edit"},
             headers: {"X-WOPI-Override": "X-LOTEK-EMBED"}
            }
        ).then(
            function(result) {
                vnode.state.data = result;
            },
            function(error) {
                console.log(error);
            }
        )
    },

    onupdate(vnode) {
        const data = vnode.state.data;
        if (!data)
            return;

        const iframe = vnode.dom;

        if (iframe.tagName !== "IFRAME")
            return;

        const doc = iframe.contentDocument;
        if (doc?.URL === 'about:blank') {
            const form = doc.createElement('form');
            form.method = 'POST';
            form.action = data.client_url;
            const access_token = doc.createElement('input');
            access_token.type = "hidden";
            access_token.name = "access_token";
            access_token.value = data.access_token;
            form.appendChild(access_token);

            const access_token_ttl = doc.createElement('input');
            access_token_ttl.type = "hidden";
            access_token_ttl.name = "access_token_ttl";
            access_token_ttl.value = data.access_token_ttl;
            form.appendChild(access_token_ttl);
            doc.body.appendChild(form);

            for (const [key, value] of data.params) {
                const input = doc.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = value;
                form.appendChild(input);
            }

            form.submit();
            return;
        }
    },

    view(vnode) {
        if (vnode.state.data === null) {
            return m(CUI.EmptyState,
                     {icon: CUI.Icons.LOADER,
                      header: "Loading ..."});
        }

        return m("iframe.container",
                 {style: "border: 0; position: absolute;"
                 });
    }
};

function is_edit_available(file, allow) {
    return allow.includes("edit");
}


export const modes = [
    {label: "View",
     is_available: is_view_available,
     component: View},
    {label: "Edit",
     is_available: is_edit_available,
     component: Edit}
];
