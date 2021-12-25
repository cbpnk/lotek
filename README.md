熵增主义个人信息管理工具。文件存在git仓库里，文件内容通过支持WOPI协议
的编辑器来编辑，文件除了内容本身以外，还可以有若干类似trilium的属性，
属性可以通过JSON Patch(RFC 6902)来编辑。集成Hypothesis和WebScrapBook的
Server。

## 属性类型

| 后缀 | 类型 |
| - | - |
| \_r | 文件ID |
| \_s | 字符串 |
| \_t | 文本 |
| \_i | 整数 |
| \_f | 浮点数 |
| \_d | 日期 |

### Category

`category_s` 用来记录文件的Category。一个文件可以有多个Category。由
Category对应的插件来显示。

## Quickstart

```
uwsgi uwsgi.ini
```
