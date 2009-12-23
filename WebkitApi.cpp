
#include <qdebug.h>
#include <qwebview.h>
#include <qwebframe.h>
#include <QMessageBox>
#include "WebkitApi.h"
#include "mainwindow.h"

WebkitApi::WebkitApi( QObject *parent )
    : QObject( parent )
{
    qDebug() << "WebkitAPI CTOR";
}

void WebkitApi::setWebView( QWebView *view )
{
    QWebPage *page = view->page();
    frame = page->mainFrame();
    attachObject();
    connect( frame, SIGNAL(javaScriptWindowObjectCleared()), this, SLOT(attachObject()) );

}

void WebkitApi::attachObject()
{
    frame->addToJavaScriptWindowObject( QString("MK"), this );
}

void WebkitApi::emitTick(qint64 i64, qint64 i64rem)
{
    int el  = i64 / 1000;
    int rem = i64rem / 1000;
    emit(elapsed(el, rem));
}

void WebkitApi::emitStateChange(QString newstate)
{
    emit(stateChange(newstate));
}

void WebkitApi::emitBufferPercent(int pc)
{
    emit(bufferPercent(pc));
}

void WebkitApi::emitTogglePause()
{
    emit(pauseToggled());
}

void WebkitApi::emitVolumeChanged(int v)
{
    emit(volumeChanged(v));
}

void WebkitApi::setVolume(int i)
{
    if(i<0) i = 0; else if(i>100) i = 100;
    emit(volumeChanged(i));
}

void WebkitApi::togglePause()
{
    emitTogglePause();
}

void WebkitApi::setWindowTitle(QString tit)
{
    ((MainWindow* )parent())->setWindowTitle(tit);
}

void WebkitApi::play(QString s)
{
    emit(playRequested(s));
}

void WebkitApi::stop()
{
    emit(stopRequested());
}
