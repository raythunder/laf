#! /usr/bin/env node

const Config = require('../dist/config').default
const { hashPassword } = require('../dist/lib/utils/hash')
const assert = require('assert')
const { MongoAccessor, getDb } = require('less-api')
const { permissions } = require('./permissions')


const accessor = new MongoAccessor(Config.db.database, Config.db.uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})

const db = getDb(accessor)

async function main() {
  await accessor.init()

  // 创建 RBAC 初始权限
  await createInitialPermissions()


  // 创建 RBAC 初始角色
  await createFirstRole()


  // 创建初始管理员
  await createFirstAdmin()

  accessor.close()
}

main()


// 创建初始管理员
async function createFirstAdmin() {
  try {
    const username = Config.SUPER_ADMIN
    const password = hashPassword(Config.SUPER_ADMIN_PASSWORD)

    const { total } = await db.collection('admins').count()
    if (total > 0) {
      console.log('admin already exists')
      return
    }

    await accessor.db.collection('admins').createIndex('username', { unique: true })

    const { data } = await db.collection('roles').get()
    const roles = data.map(it => it.name)

    const r_add = await db.collection('admins').add({
      username,
      avatar: "https://static.dingtalk.com/media/lALPDe7szaMXyv3NAr3NApw_668_701.png",
      name: 'Admin',
      roles,
      created_at: Date.now(),
      updated_at: Date.now()
    })
    assert(r_add.ok, 'add admin occurs error')

    await db.collection('password').add({
      uid: r_add.id,
      password,
      type: 'login',
      created_at: Date.now(),
      updated_at: Date.now()
    })

    return r_add.id
  } catch (error) {
    console.error(error.message)
  }
}

// 创建初始角色
async function createFirstRole() {
  try {

    await accessor.db.collection('roles').createIndex('name', { unique: true })

    const r_perm = await db.collection('permissions').get()
    assert(r_perm.ok, 'get permissions failed')

    const permissions = r_perm.data.map(it => it.name)

    const r_add = await db.collection('roles').add({
      name: 'superadmin',
      label: '超级管理员',
      description: '系统初始化的超级管理员',
      permissions,
      created_at: Date.now(),
      updated_at: Date.now()
    })

    assert(r_add.ok, 'add role occurs error')

    return r_add.id
  } catch (error) {
    if (error.code == 11000) {
      return console.log('permissions already exists')
    }

    console.error(error.message)
  }
}

// 创建初始权限
async function createInitialPermissions() {

  // 创建唯一索引
  await accessor.db.collection('permissions').createIndex('name', { unique: true })

  for (const perm of permissions) {
    try {
      const data = {
        ...perm,
        created_at: Date.now(),
        updated_at: Date.now()
      }
      await db.collection('permissions').add(data)
    } catch (error) {
      if (error.code == 11000) {
        console.log('permissions already exists')
        continue
      }
      console.error(error.message)
    }
  }

  return true
}