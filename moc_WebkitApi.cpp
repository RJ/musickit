/****************************************************************************
** Meta object code from reading C++ file 'WebkitApi.h'
**
** Created: Wed Dec 23 13:49:07 2009
**      by: The Qt Meta Object Compiler version 62 (Qt 4.6.0)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include "WebkitApi.h"
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'WebkitApi.h' doesn't include <QObject>."
#elif Q_MOC_OUTPUT_REVISION != 62
#error "This file was generated using the moc from 4.6.0. It"
#error "cannot be used with the include files from this version of Qt."
#error "(The moc has changed too much.)"
#endif

QT_BEGIN_MOC_NAMESPACE
static const uint qt_meta_data_WebkitApi[] = {

 // content:
       4,       // revision
       0,       // classname
       0,    0, // classinfo
      12,   14, // methods
       0,    0, // properties
       0,    0, // enums/sets
       0,    0, // constructors
       0,       // flags
       7,       // signalCount

 // signals: signature, parameters, type, tag, flags
      13,   11,   10,   10, 0x05,
      30,   10,   10,   10, 0x05,
      51,   10,   10,   10, 0x05,
      70,   10,   10,   10, 0x05,
      89,   10,   10,   10, 0x05,
     104,   10,   10,   10, 0x05,
     127,   10,   10,   10, 0x05,

 // slots: signature, parameters, type, tag, flags
     143,   10,   10,   10, 0x0a,
     157,   10,   10,   10, 0x0a,
     172,   10,   10,   10, 0x0a,
     186,   10,   10,   10, 0x0a,
     193,   10,   10,   10, 0x08,

       0        // eod
};

static const char qt_meta_stringdata_WebkitApi[] = {
    "WebkitApi\0\0,\0elapsed(int,int)\0"
    "stateChange(QString)\0bufferPercent(int)\0"
    "volumeChanged(int)\0pauseToggled()\0"
    "playRequested(QString)\0stopRequested()\0"
    "togglePause()\0setVolume(int)\0play(QString)\0"
    "stop()\0attachObject()\0"
};

const QMetaObject WebkitApi::staticMetaObject = {
    { &QObject::staticMetaObject, qt_meta_stringdata_WebkitApi,
      qt_meta_data_WebkitApi, 0 }
};

#ifdef Q_NO_DATA_RELOCATION
const QMetaObject &WebkitApi::getStaticMetaObject() { return staticMetaObject; }
#endif //Q_NO_DATA_RELOCATION

const QMetaObject *WebkitApi::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->metaObject : &staticMetaObject;
}

void *WebkitApi::qt_metacast(const char *_clname)
{
    if (!_clname) return 0;
    if (!strcmp(_clname, qt_meta_stringdata_WebkitApi))
        return static_cast<void*>(const_cast< WebkitApi*>(this));
    return QObject::qt_metacast(_clname);
}

int WebkitApi::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = QObject::qt_metacall(_c, _id, _a);
    if (_id < 0)
        return _id;
    if (_c == QMetaObject::InvokeMetaMethod) {
        switch (_id) {
        case 0: elapsed((*reinterpret_cast< int(*)>(_a[1])),(*reinterpret_cast< int(*)>(_a[2]))); break;
        case 1: stateChange((*reinterpret_cast< QString(*)>(_a[1]))); break;
        case 2: bufferPercent((*reinterpret_cast< int(*)>(_a[1]))); break;
        case 3: volumeChanged((*reinterpret_cast< int(*)>(_a[1]))); break;
        case 4: pauseToggled(); break;
        case 5: playRequested((*reinterpret_cast< QString(*)>(_a[1]))); break;
        case 6: stopRequested(); break;
        case 7: togglePause(); break;
        case 8: setVolume((*reinterpret_cast< int(*)>(_a[1]))); break;
        case 9: play((*reinterpret_cast< QString(*)>(_a[1]))); break;
        case 10: stop(); break;
        case 11: attachObject(); break;
        default: ;
        }
        _id -= 12;
    }
    return _id;
}

// SIGNAL 0
void WebkitApi::elapsed(int _t1, int _t2)
{
    void *_a[] = { 0, const_cast<void*>(reinterpret_cast<const void*>(&_t1)), const_cast<void*>(reinterpret_cast<const void*>(&_t2)) };
    QMetaObject::activate(this, &staticMetaObject, 0, _a);
}

// SIGNAL 1
void WebkitApi::stateChange(QString _t1)
{
    void *_a[] = { 0, const_cast<void*>(reinterpret_cast<const void*>(&_t1)) };
    QMetaObject::activate(this, &staticMetaObject, 1, _a);
}

// SIGNAL 2
void WebkitApi::bufferPercent(int _t1)
{
    void *_a[] = { 0, const_cast<void*>(reinterpret_cast<const void*>(&_t1)) };
    QMetaObject::activate(this, &staticMetaObject, 2, _a);
}

// SIGNAL 3
void WebkitApi::volumeChanged(int _t1)
{
    void *_a[] = { 0, const_cast<void*>(reinterpret_cast<const void*>(&_t1)) };
    QMetaObject::activate(this, &staticMetaObject, 3, _a);
}

// SIGNAL 4
void WebkitApi::pauseToggled()
{
    QMetaObject::activate(this, &staticMetaObject, 4, 0);
}

// SIGNAL 5
void WebkitApi::playRequested(QString _t1)
{
    void *_a[] = { 0, const_cast<void*>(reinterpret_cast<const void*>(&_t1)) };
    QMetaObject::activate(this, &staticMetaObject, 5, _a);
}

// SIGNAL 6
void WebkitApi::stopRequested()
{
    QMetaObject::activate(this, &staticMetaObject, 6, 0);
}
QT_END_MOC_NAMESPACE
