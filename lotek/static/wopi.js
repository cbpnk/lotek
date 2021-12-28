const WOPIFrame = {
    onremove(vnode) {
        if (vnode.state.message_listener)
            window.removeEventListener('message', vnode.state.message_listener);

        if (vnode.state.events_listener)
            vnode.attrs.events.removeEventListener('message', vnode.state.events_listener);
    },

    oncreate(vnode) {
        const config = vnode.attrs.config;

        if (!vnode.state.message_listener) {
            vnode.state.message_listener = function(event) {
                const contentWindow = vnode.dom.contentWindow;
                if ((contentWindow.length > 0) && (event.source === contentWindow[0])) {
                    const data = event.data;
                    if (data.jsonrpc !== '2.0')
                        return;

                    if (data.method !== 'requestConfig')
                        return;
                    const result = {
                        services: [
                            {apiUrl: `${window.location.origin}/hypothesis/api/`,
                             grantToken: config.access_token,
                             sentry: {enabled: false}}
                        ],
                    };
                    const annotFragmentMatch = window.location.hash.match(
                        /^#annotations:([A-Za-z0-9_-]+)$/
                    );
                    if (annotFragmentMatch) {
                        result.annotations = annotFragmentMatch[1];
                    }

                    event.source.postMessage(
                        {jsonrpc: '2.0',
                         id: data.id,
                         result
                        },
                        event.origin
                    );
                } else if (event.source === contentWindow) {
                    const data = JSON.parse(event.data);
                    const Values = data.Values;
                    switch (data.MessageId) {
                    case "Get_InitialBookmark":
                        event.source.postMessage(
                            JSON.stringify(
                                {MessageId: "Get_InitialBookmark_Resp",
                                 SendTime: new Date().valueOf(),
                                 Values: {
                                     bookmark: window.location.hash.substring(1)
                                 }
                                }),
                            event.origin
                        );
                        break;
                    case "App_LoadingStatus":
                        if (Values.Status === 'Frame_Ready') {
                            event.source.postMessage(
                                JSON.stringify(
                                    {MessageId: "Host_PostmessageReady",
                                     SendTime: new Date().valueOf(),
                                     Values: {}
                                    }
                                ),
                                event.origin
                            );
                        }
                        break;
                    case "Doc_ModifiedStatus":
                        vnode.attrs.set_button_enabled("save", Values.Modified);
                        m.redraw();
                        break;
                    }

                }
            };

            window.addEventListener('message', vnode.state.message_listener);
        }

        if (vnode.attrs.events) {
            const origin = new URL(config.client_url).origin;
            vnode.state.events_listener = function(event) {
                if (!vnode.dom.contentWindow)
                    return;
                switch (event.type) {
                case 'save':
                    vnode.dom.contentWindow.postMessage(
                        JSON.stringify(
                            {MessageId: "Action_Save",
                             SendTime: new Date().valueOf(),
                             Values: {
                                 DontTerminateEdit: true,
                                 DontSaveIfUnmodified: true,
                                 Notify: false,
                             },
                            }
                        ),
                        origin
                    );
                    break;
                }
            };

            vnode.attrs.events.addEventListener('save', vnode.state.events_listener);
        }

        const doc = vnode.dom.contentDocument;
        if (doc?.URL === 'about:blank') {
            const form = doc.createElement('form');
            form.method = 'POST';
            form.action = config.client_url;
            const access_token = doc.createElement('input');
            access_token.type = "hidden";
            access_token.name = "access_token";
            access_token.value = config.access_token;
            form.appendChild(access_token);

            const access_token_ttl = doc.createElement('input');
            access_token_ttl.type = "hidden";
            access_token_ttl.name = "access_token_ttl";
            access_token_ttl.value = config.access_token_ttl;
            form.appendChild(access_token_ttl);
            doc.body.appendChild(form);

            for (const [key, value] of config.params) {
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
        return m("iframe.container",
                 {style: "border: 0; position: absolute;",
                 });
    }
};

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

    view(vnode) {
        if (vnode.state.data === null) {
            return m(CUI.EmptyState,
                     {icon: CUI.Icons.LOADER,
                      header: "Loading ..."});
        }

        return m(WOPIFrame,
                 {config: vnode.state.data,
                  events: vnode.attrs.events,
                  set_button_enabled: vnode.attrs.set_button_enabled,
                 }
                );
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

    view(vnode) {
        if (vnode.state.data === null) {
            return m(CUI.EmptyState,
                     {icon: CUI.Icons.LOADER,
                      header: "Loading ..."});
        }

        return m(WOPIFrame,
                 {config: vnode.state.data,
                  events: vnode.attrs.events,
                  set_button_enabled: vnode.attrs.set_button_enabled,
                 });
    }
};

function is_edit_available(file, allow) {
    return allow.includes("edit");
}


export const modes = [
    {name: "view",
     label: "View",
     is_available: is_view_available,
     component: View},
    {name: "edit",
     label: "Edit",
     is_available: is_edit_available,
     component: Edit,
     buttons: [
         {name: "save",
          label: "Save"}
     ]}
];
