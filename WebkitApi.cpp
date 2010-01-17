
#include <qdebug.h>
#include <qwebview.h>
#include <qwebframe.h>
#include <QMessageBox>
#include "WebkitApi.h"
#include "mainwindow.h"

WebkitApi::WebkitApi( Playdar::Client * client, Playengine * p, QObject *parent )
    : QObject( parent )
{
    pc = client;
    player = p;
    qDebug() << "WebkitAPI CTOR";

    connect(player, SIGNAL(tick(int,int)),
            this,   SIGNAL(tick(int,int)));
    connect(player, SIGNAL(buffering(int)),
            this,   SIGNAL(buffering(int)));
    connect(player, SIGNAL(volume(int)),
            this,   SIGNAL(volumeChanged(int)));
    connect(player, SIGNAL(statusChanged(Playengine::STATUS)),
            this,   SLOT(reemitStatusChanged(Playengine::STATUS)));
    connect(pc,     SIGNAL(onResult(Playdar::q_ptr,Playdar::r_ptr)),
            this,   SLOT(onResult(Playdar::q_ptr,Playdar::r_ptr)));
}

void WebkitApi::setWebView( QWebView *view )
{
    QWebPage *page = view->page();
    frame = page->mainFrame();
    attachObject();
    connect( frame, SIGNAL(javaScriptWindowObjectCleared()),
             this,  SLOT(attachObject()) );
    //connect( frame, SIGNAL(titleChanged(QString)),
    //         ((MainWindow* )parent()), SLOT(setWindowTitle(QString)) );
}

void WebkitApi::attachObject()
{
    frame->addToJavaScriptWindowObject( QString("MK"), this );
}

void WebkitApi::reemitStatusChanged(Playengine::STATUS s)
{
    switch(s)
    {
    case Playengine::PLAYING:
        emit(stateChange("playing"));
        break;
    case Playengine::PAUSED:
        emit(stateChange("paused"));
        break;
    case Playengine::LOADING:
        emit(stateChange("loading"));
        break;
    case Playengine::ERROR:
        emit(stateChange("error"));
        break;
    case Playengine::STOPPED:
        emit(stateChange("stopped"));
        break;
    }
}

void WebkitApi::setVolume(int i)
{
    player->setVolume(i);
}

void WebkitApi::togglePause()
{
    player->togglePause();
}

void WebkitApi::play(QString s)
{
    qDebug() << "play: " << s;
    player->play(QUrl(s));
}

void WebkitApi::stop()
{
    player->stop();
}

void WebkitApi::log(QString s)
{
    qDebug() << s;
}

// PLAYDAR STUFF

void WebkitApi::resolve(const QString &str)
{
    pc->resolve(str);
}

void WebkitApi::onResult(Playdar::q_ptr q, Playdar::r_ptr r)
{
    QVariantMap vmap = QJson::QObjectHelper::qobject2qvariant(r.data());
    const QByteArray serialized = serializer.serialize( vmap );
    emit(result(q->qid(), QString::fromAscii(serialized)));
}
