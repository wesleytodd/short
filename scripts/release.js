'use strict'
const github = require('@actions/github')
const semver = require('semver')
const fs = require('fs').promises

async function commit (client, opts) {
  const files = await Promise.all(opts.files.map(async (file) => {
    const { data: blob } = await client.git.createBlob({
      owner: opts.owner,
      repo: opts.repo,
      content: await fs.readFile(file, { encoding: 'base64' }),
      encoding: 'base64'
    })

    return {
      sha: blob.sha,
      path: file,
      mode: '100644',
      type: 'blob'
    }
  }))

  const { data: tree } = await client.git.createTree({
    owner: opts.owner,
    repo: opts.repo,
    tree: files,
    base_tree: opts.sha
  })

  const { data: commit } = await client.git.createCommit({
    owner: opts.owner,
    repo: opts.repo,
    message: opts.commitMessage || 'commit',
    tree: tree.sha,
    parents: [opts.sha]
  })

  return commit
}

async function createTag (client, opts) {
  const { data: refs } = await client.git.listMatchingRefs({
    owner: opts.owner,
    repo: opts.repo,
    ref: `tags/${opts.tag}`
  })
  if (refs.find((refObj) => refObj.ref.endsWith(opts.tag))) {
    await client.git.updateRef({
      owner: opts.owner,
      repo: opts.repo,
      force: true,
      ref: `tags/${opts.tag}`,
      sha: opts.sha
    })
  } else {
    await client.git.createRef({
      owner: opts.owner,
      repo: opts.repo,
      ref: `refs/tags/${opts.tag}`,
      sha: opts.sha
    })
  }
}

;(async (token) => {
  const client = new github.GitHub(token)
  const context = github.context
  const tag = context.ref.replace('refs/tags/v', '')
  const ver = semver.parse(tag)

  try {
    const { sha } = await commit(client, {
      ...context.repo,
      sha: context.sha,
      commitMessage: `v${tag} build`,
      files: [
        'dist/index.js',
        'dist/index.js.map',
        'dist/sourcemap-register.js'
      ]
    })
    console.log(`Created commit: ${sha}`)

    await createTag(client, {
      ...context.repo,
      tag: `v${ver.major}`,
      sha: sha
    })
    console.log(`Created tag: v${ver.major}@${sha}`)

    await createTag(client, {
      ...context.repo,
      tag: `v${ver.major}.${ver.minor}`,
      sha: sha
    })
    console.log(`Created tag: v${ver.major}.${ver.minor}@${sha}`)
  } catch (e) {
    console.error(e)
    throw e
  }
})(process.env.GITHUB_TOKEN)
