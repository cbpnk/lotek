const html = htm.bind(m);
window.registry = {};
registry.onload = [];

let start_retry = null;
let wait_retry = null;

async function request(options) {
    options.headers = options.headers || {};
    if ((options.method != "GET") && (options.method != "HEAD")) {
        options.headers["X-CSRF-Token"] = CSRF_TOKEN;
        options.headers["X-Lotek-Date"] = (new Date()).toUTCString();
    }

    const extract = options.extract;
    if (extract) {
        options.extract = (xhr) => xhr;
    }

    while(true) {
        try {
            if (extract) {
                const xhr = await m.request(options);
                const success = (xhr.status >= 200 && xhr.status < 300) || xhr.status === 304;
                if (success) {
                    return extract(xhr, options);
                }
                const error = new Error();
                error.code = xhr.status;
                throw(error);
            } else {
                return await m.request(options);
            }
        } catch (error) {
            if ((error.code === 0) || (error.code >= 500)) {
                if (!start_retry) {
                    wait_retry = new Promise(
                        (resolve, reject) => {
                            start_retry = function() {
                                start_retry = null;
                                resolve();
                            }
                        }
                    );
                }
                await wait_retry;
                continue
            }
            if (error.code === 401) {
                USER = null;
            }
            throw(error);
        }
    }
}

window.addEventListener(
    'load',
    function() {
        (async function() {
            const plugins = [];
            for (const name of PLUGINS) {
                const plugin = await import(`/static/${name}.js`);
                plugins.push(plugin);
                Object.assign(registry, plugin.registry || {});
            }

            for (const plugin of plugins) {
                for (let name in registry) {
                    if (registry[name] instanceof Array) {
                        registry[name].push(...(plugin[name] || []));
                    } else {
                        Object.assign(registry[name], plugin[name] || {});
                    }
                }
            }

            for (const f of registry.onload) {
                f();
            }
        })();
    }
);
