import {SidePanel} from "/static/sidepanel.js";
import {SearchBar} from "/static/search.js";

function is_open_available(file, allow) {
    return allow.includes("open");
}

function open_onclick(id) {
    request(
        {method: "POST",
         url: "/:id",
         params: {id},
         headers: {"X-WOPI-Override": "X-LOTEK-OPEN"},
        }
    )
}

const File = {
    oninit(vnode) {
        const record = vnode.attrs.record;
        if (record.ext) {
            document.title = `${record.name || vnode.attrs.id }.${record.ext}`;
        } else {
            document.title = `${record.name || vnode.attrs.id }`;
        }

        vnode.state.edit_title = null;
        vnode.state.events = new EventTarget();
    },

    view(vnode) {
        const patch = vnode.attrs.patch;
        const modes = registry.modes.filter((mode) => mode.is_available(vnode.attrs.record, vnode.attrs.allow));
        const actions = registry.actions.filter((action) => action.is_available(vnode.attrs.record, vnode.attrs.allow));

        const active = m.route.param("mode") || modes[0].name;
        const active_mode = modes.find((mode) => mode.name === active);

        if (active !== vnode.state.last_active)
            vnode.state.enabled = {};

        vnode.state.last_active = active;

        function set_button_enabled(name, enabled) {
            vnode.state.enabled[name] = enabled;
        }

        return [
            m(".container", {style: "position: relative;"},
              m(SidePanel,
                {isOpen: true,
                 style: "position: absolute;",
                 panel:
                 registry.widgets.map(
                     (widget) =>
                     m(widget,
                       {id: vnode.attrs.id,
                        file: vnode.attrs.record,
                        patch: patch}
                      )
                 )
                },
                m(".column-flex.container",
                  m(".row-flex",
                    {style: "align-items: center;"},
                    (vnode.state.edit_title !== null)?
                    m(CUI.ControlGroup,
                      {"class": "cui-fluid"},
                      m(CUI.Input,
                        {fluid: true,
                         value: vnode.state.edit_title,
                         oninput(e) { vnode.state.edit_title = e.target.value; }}
                       ),
                      m(CUI.Button,
                        {intent: "primary",
                         label: "Save",
                         onclick() {
                             patch(
                                 (vnode.attrs.record.name)?
                                     [{op: "replace", path: "/name", value: vnode.state.edit_title}]
                                     :
                                     [{op: "add", path: "/name", value: vnode.state.edit_title}],
                                 {'Subject': encodeURIComponent(`Rename to ${vnode.state.edit_title}`)}
                             );
                             vnode.state.edit_title = null;
                         }
                        }),
                      m(CUI.Button,
                        {label: "Cancel",
                         onclick() { vnode.state.edit_title = null; }})
                     )
                    :
                    m("h1.container",
                      vnode.attrs.record.name || "Untitled",
                      m(CUI.Icon,
                        {name: CUI.Icons.EDIT,
                         onclick() {
                             vnode.state.edit_title = vnode.attrs.record.name || "";
                         }}
                       )
                     ),
                    (modes.length > 0)?
                    m(CUI.ControlGroup,
                      (active_mode.buttons || []).map(
                          (button) =>
                          m(CUI.Button,
                            {style: "sm",
                             label: button.label,
                             disabled: !vnode.state.enabled[button.name],
                             size: "sm",
                             onclick() {
                                 vnode.state.events.dispatchEvent(new CustomEvent(button.name));
                             }
                            }
                           )
                      )
                     )
                    :null,
                    (modes.length > 0)?
                    m(CUI.ControlGroup,
                      {style: "justify-content: flex-end;"},
                      m(CUI.PopoverMenu,
                        {trigger:
                         m(CUI.Button,
                           {style: "sm",
                            active: true,
                            label: active_mode.label,
                            size: "sm",
                            iconRight: CUI.Icons.CHEVRON_DOWN}
                          ),
                         content: [
                             modes.map(
                                 (mode, i) =>
                                 (mode.name !== active)?
                                     m(CUI.MenuItem,
                                       {label: mode.label,
                                        onclick() {
                                            m.route.set(
                                                m.buildPathname("/:id", {id: vnode.attrs.id}),
                                                {mode: mode.name});
                                        }
                                       }
                                      )
                                     :null
                             ),
                             m(CUI.MenuDivider),
                             actions.map(
                                 (action) =>
                                 m(CUI.MenuItem,
                                   {label: action.label,
                                    onclick() { action.onclick(vnode.attrs.id) }
                                   }
                                  )
                             )
                         ]
                        }
                       )
                     )
                    :null
                   ),
                  m(".container", {style: "position: relative;"},
                    (modes.length > 0)?
                    m(active_mode.component,
                      {key: active,
                       id: vnode.attrs.id,
                       file: vnode.attrs.record,
                       events: vnode.state.events,
                       set_button_enabled}):null
                   )
                 )
               )
             )

        ];
    }
};

export const types = {file: File};

export const registry = {
    widgets: [],
    modes: [],
    actions: [
        {label: "Open Containing Folder",
         is_available: is_open_available,
         onclick: open_onclick}
    ],
};
