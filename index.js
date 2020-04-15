'use strict'
const core = require('@actions/core')
const github = require('@actions/github')
const HashIds = require('hashids/cjs')

// https://stackoverflow.com/questions/18565425/how-do-i-create-an-orphan-branch-from-the-github-api
const ORHPAN_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

;(async function run () {
  try {
    if (github.context.eventName !== 'issues') {
      return
    }

    const token = core.getInput('token')
    const client = new github.GitHub(token)
    await onIssue(client, github.context.repo, github.context.payload)
  } catch (e) {
    console.error(e)
    core.setFailed(e.message)
  }
})()

async function onIssue (client, repo, { action, label, issue }) {
  switch (action) {
    case 'opened':
      // @TODO if opened by committer, just auto lable and close
      break
    case 'unlabeled':
      // @TODO remove link on unlabled
      break
    case 'labeled': {
      if (issue.state !== 'open' || label.name !== 'shorten') {
        return
      }
      const { title, body, number } = issue
      const { owner, repo: name } = repo
      const [firstLine, secondLine, ...restLines] = body.split('\n')

      // Process issue into links
      let to
      let from
      const base = `https://${owner}.github.io`
      const urlLine = (line) => new URL(`/${name}/${line || (new HashIds()).encode(number)}`, base)
      try {
        to = new URL(title)
        from = urlLine(firstLine)
      } catch (e) {
        to = new URL(firstLine)
        try {
          from = urlLine(secondLine)
        } catch (e) {
          from = urlLine()
        }
      }

      // Add to index
      let ghPagesExists = false
      let pagesSha = ORHPAN_SHA
      try {
        const resp = await client.git.getRef({
          ...repo,
          ref: 'heads/gh-pages'
        })
        pagesSha = resp.data.object.sha
        ghPagesExists = true
      } catch (e) { }

      // Get index content
      let existingIndex = {}
      try {
        const { data: indexContent } = await client.repos.getContents({
          ...repo,
          path: 'index.json',
          ref: 'heads/gh-pages'
        })
        existingIndex = JSON.parse(Buffer.from(indexContent.content, indexContent.encoding).toString())
      } catch (e) {
        console.log(e)
        // ignore, no index
      }

      const index = {
        ...existingIndex,
        [from]: to
      }
      const { data: indexBlob } = await client.git.createBlob({
        ...repo,
        content: Buffer.from(JSON.stringify(index)).toString('base64'),
        encoding: 'base64'
      })

      const { data: pageBlob } = await client.git.createBlob({
        ...repo,
        content: Buffer.from(`<!DOCTYPE html><meta http-equiv="refresh" content="0;url=${to.toString()}">`).toString('base64'),
        encoding: 'base64'
      })

      const { data: noJekyllBlob } = await client.git.createBlob({
        ...repo,
        content: '',
        encoding: 'base64'
      })
      const { data: homeBlob } = await client.git.createBlob({
        ...repo,
        content: Buffer.from(`<!DOCTYPE html><h1>Short!</h1><ul>${Object.keys(index).map((f) => {
          return `<li><a href="${index[f]}">${f}</a></li>`
        }).join('')}</ul>`).toString('base64'),
        encoding: 'base64'
      })

      // Create the tree
      const { data: tree } = await client.git.createTree({
        ...repo,
        tree: [{
          sha: noJekyllBlob.sha,
          path: '.nojekyll',
          mode: '100644',
          type: 'blob'
        }, {
          sha: homeBlob.sha,
          path: 'index.html',
          mode: '100644',
          type: 'blob'
        }, {
          sha: indexBlob.sha,
          path: 'index.json',
          mode: '100644',
          type: 'blob'
        }, {
          sha: pageBlob.sha,
          path: `${from.pathname.replace(`/${name}/`, '')}/index.html`,
          mode: '100644',
          type: 'blob'
        }],
        base_tree: pagesSha
      })

      // Create our commit
      const { data: commit } = await client.git.createCommit({
        ...repo,
        message: `${from} to ${to} (closes #${number})${restLines.length ? ` \n\n${restLines.join('\n')}` : ''}`,
        tree: tree.sha,
        parents: pagesSha === ORHPAN_SHA ? [] : [pagesSha]
      })

      // Create or update gh-pages branch if it didn't exist
      if (!ghPagesExists) {
        await client.git.createRef({
          ...repo,
          ref: 'refs/heads/gh-pages',
          sha: commit.sha
        })
      } else {
        await client.git.updateRef({
          ...repo,
          force: true,
          ref: 'heads/gh-pages',
          sha: commit.sha
        })
      }

      console.log(commit.sha, commit.message)

      // Comment on issue
      await client.issues.createComment({
        ...repo,
        issue_number: number,
        body: `Your shortlink has been created!\n\n${from} now points to ${to}`
      })

      // Close issue
      await client.issues.update({
        ...repo,
        issue_number: number,
        state: 'closed'
      })
      break
    }
  }
}
